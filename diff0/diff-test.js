const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");


const { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } = require("./diff_match_patch");

/**
 * Converts the result of diff_match_patch into a Git diff-like patch.
 * @param {string} oldText - The original text.
 * @param {string} newText - The modified text.
 * @param {string} fileName - The name of the file being diffed.
 * @returns {string} - The Git diff-like patch.
 */
function generateGitDiffDMP(oldText, newText, fileName) {
    const oldLines = oldText.split(/\r?\n/);
    const newLines = newText.split(/\r?\n/);
    var changes = diffLines(oldLines, newLines);
    return createPatch(oldLines, newLines, changes, fileName);
}

const { computeDiff } = require("./vscode-diff/index");

/**
 * Converts the result of computeDiff into a Git diff-like patch.
 * @param {string} oldText - The original text.
 * @param {string} newText - The modified text.
 * @param {string} fileName - The name of the file being diffed.
 * @returns {string} - The Git diff-like patch.
 */
function generateGitDiffFromComputeDiff(oldText, newText, fileName) {
    const oldLines = oldText.split(/\r?\n/);
    const newLines = newText.split(/\r?\n/);

    // Call computeDiff to get the changes
    const changes = computeDiff(oldLines, newLines, { ignoreTrimWhitespace: true, maxComputationTimeMs: 0 });

    return createPatch(oldLines, newLines, changes, fileName);
}

var userDiffs = [generateGitDiffDMP, generateGitDiffFromComputeDiff];

var gitRootDir = ""
// Helper function to run a git command and return the output
function runGitCommand(args) {
    if (!gitRootDir && args != "git rev-parse --show-toplevel") {
        gitRootDir = process.cwd()
        gitRootDir = runGitCommand("git rev-parse --show-toplevel")
        console.log(gitRootDir)
    }
    if (typeof args == "string") args = args.split(/ +/);
    if (args[0] == "git") args.shift()
    console.log("git", args)
    return execFileSync("git", args, { encoding: "utf8", cwd: gitRootDir }).trim();
}

// Main function
function compareDiffs() {
    var max = 6;
    const outputDir = path.join(__dirname, "diff_mismatches");
    if (fs.existsSync(outputDir)) {
        fs.rmdirSync(outputDir, { recursive: true, force: true });
    }

    fs.mkdirSync(outputDir);

    // Fetch all commits in the repository history
    const commits = runGitCommand("rev-list --all").split("\n");

    commits.forEach((commit, index) => {
        console.log(`Processing commit: ${commit}`);

        // Fetch the list of files changed in the commit
        const files = runGitCommand(`git diff-tree --no-commit-id --name-only -r ${commit}`).split("\n");

        console.log(files);
        files.forEach(file => {
            if (!file) return; // Skip empty lines
            console.log(`  Processing file: ${file}`);

            try {
                // Fetch the file content before and after the commit
                const oldText = runGitCommand(`git show ${commit}^:${file}`);
                const newText = runGitCommand(`git show ${commit}:${file}`);

                // Fetch the git diff for the file
                const gitDiff = runGitCommand(`git diff ${commit}^ ${commit} -- ${file}`);

                if (gitDiff != "") {
                    console.log("just for test");
                }


                userDiffs.forEach((userDiff, i) => {
                    // Generate the diff using the user-provided function
                    const userGeneratedDiff = userDiff(oldText, newText, file);

                    // Compare the user-generated diff with the git diff
                    if (gitDiff !== userGeneratedDiff) {
                        if (--max < 0) {
                            console.log("Max limit reached, stopping further comparisons.");
                            return process.exit(1);
                        }
                        console.log(`    Diff mismatch found for file: ${file}`);

                        // Create a folder for the mismatched diff
                        var fileIndexString = index.toString().padStart(5, 0);
                        const fileOutputDir = path.join(outputDir, `${userDiff.name}__${fileIndexString}__${commit}_${file.replace(/\//g, "_")}`);
                        if (!fs.existsSync(fileOutputDir)) {
                            fs.mkdirSync(fileOutputDir);
                        }

                        // Write old.txt, new.txt, git.diff, and user.diff
                        fs.writeFileSync(path.join(fileOutputDir, "old.txt"), oldText, "utf8");
                        fs.writeFileSync(path.join(fileOutputDir, "new.txt"), newText, "utf8");
                        fs.writeFileSync(path.join(fileOutputDir, "git.diff"), gitDiff, "utf8");
                        fs.writeFileSync(path.join(fileOutputDir, "user.diff"), userGeneratedDiff, "utf8");
                    }
                });
            } catch (error) {
                console.error(`    Error processing file: ${file}`, error.message);
            }
        });
    });

    console.log("Diff comparison completed.");
}

// part for diff_match_patch.js
var diff_linesToChars_ = function(text1, text2) {
    var lineHash = Object.create(null);
    var lineCount = 1;

    function diff_linesToCharsMunge_(lines) {
        var chars = "";
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (typeof lineHash[line] === "number") {
                chars += String.fromCharCode(lineHash[line]);
            } else {
                chars += String.fromCharCode(lineCount);
                lineHash[line] = lineCount++;
            }
        }
        return chars;
    }
    var chars1 = diff_linesToCharsMunge_(text1);
    var chars2 = diff_linesToCharsMunge_(text2);
    return {
        chars1: chars1,
        chars2: chars2,
    };
};

function diffLines(oldLines, newLines) {
    const dmp = new diff_match_patch();
    var a = diff_linesToChars_(oldLines, newLines);
    var diff = dmp.diff_main(a.chars1, a.chars2, false);
    var chunks = [];
    var offset = {
        left: 0,
        right: 0,
    };
    var lastChunk;
    diff.forEach(function(chunk) {
        var chunkType = chunk[0];
        var length = chunk[1].length;

        // oddly, occasionally the algorithm returns a diff with no changes made
        if (length === 0) {
            return;
        }
        if (chunkType === 0) {
            offset.left += length;
            offset.right += length;
            lastChunk = null;
        } else if (chunkType === -1) {
            if (lastChunk) {
                lastChunk.origEnd = Math.max(offset.left + length, lastChunk.origEnd);
                lastChunk.editEnd = Math.max(offset.right, lastChunk.editEnd);
            } else {
                chunks.push(
                    (lastChunk = {
                        origStart: offset.left,
                        origEnd: offset.left + length,
                        editStart: offset.right,
                        editEnd: offset.right,
                    })
                );
            }
            offset.left += length;
        } else if (chunkType === 1) {
            if (lastChunk) {
                lastChunk.origEnd = Math.max(offset.left, lastChunk.origEnd);
                lastChunk.editEnd = Math.max(offset.right + length, lastChunk.editEnd);
            } else {
                chunks.push(
                    (lastChunk = {
                        origStart: offset.left,
                        origEnd: offset.left,
                        editStart: offset.right,
                        editEnd: offset.right + length,
                    })
                );
            }
            offset.right += length;
        }
    });

    chunks.forEach(function(diff) {
        var inlineChanges = [];
        var type = 0;
        if (diff.origStart == diff.origEnd) {
            type = 1;
        } else if (diff.editStart == diff.editEnd) {
            type = -1;
        } else {
            var inlineDiff = dmp.diff_main(
                oldLines.slice(diff.origStart, diff.origEnd).join("\n"),
                newLines.slice(diff.editStart, diff.editEnd).join("\n"),
                false
            );
            dmp.diff_cleanupSemantic(inlineDiff);
            inlineDiff.forEach(function(change) {
                var text = change[1];
                var lines = text.split("\n");
                var rowCh = lines.length - 1;
                var colCh = lines[rowCh].length;
                var changeType = change[0];
                if (text.length) {
                    inlineChanges.push([changeType, rowCh, colCh]);
                    // if (changeType) {
                    //     if (!type) {
                    //         type = changeType;
                    //     } else if (type != changeType) {
                    //         type = 2;
                    //     }
                    // }
                }
            });
        }
        diff.inlineChanges = inlineChanges;
        diff.type = type;
    });
    return chunks;
}

function createPatch(oldLines, newLines, changes, fileName) {
    var chunks = changes;
    var editLines = newLines;
    var origLines = oldLines;
    var path1 = fileName;
    var path2 = fileName;
    var patch = [
        "diff --git a/" + path1 + " b/" + path2,
        "--- a/" + path1,
        "+++ b/" + path2,
    ].join("\n");

    if (!chunks.length) {
        chunks = [
            {
                origStart: 0,
                origEnd: 0,
                editStart: 0,
                editEnd: 0,
            },
        ];
    }

    function header(s1, c1, s2, c2) {
        return (
            "@@ -" +
            (c1 ? s1 + 1 : s1) +
            "," +
            c1 +
            " +" +
            (c2 ? s2 + 1 : s2) +
            "," +
            c2 +
            " @@"
        );
    }

    var context = 0;
    // changed newline at the end of file
    var editEOF = !editLines[editLines.length - 1];
    var origEOF = !origLines[origLines.length - 1];
    if (editEOF) editLines.pop();
    if (origEOF) origLines.pop();
    if (editEOF != origEOF) {
        chunks = chunks.slice();
        var last = chunks.pop();
        chunks.push(
            (last = {
                origStart: Math.min(last.origStart, origLines.length - 1),
                origEnd: Math.min(last.origEnd, origLines.length),
                editStart: Math.min(last.editStart, editLines.length - 1),
                editEnd: Math.min(last.editEnd, editLines.length),
            })
        );
    }

    var hunk = "";
    var start1 = 0;
    var start2 = 0;
    var end1 = 0;
    var end2 = 0;
    var length1 = 0;
    var length2 = 0;
    var mergeWithNext = false;
    for (var i = 0; i < chunks.length; i++) {
        var ch = chunks[i];
        var s1 = ch.origStart;
        var e1 = ch.origEnd;
        var s2 = ch.editStart;
        var e2 = ch.editEnd;
        var next = chunks[i + 1];

        start1 = Math.max(s1 - context, end1);
        start2 = Math.max(s2 - context, end2);
        end1 = Math.min(e1 + context, origLines.length);
        end2 = Math.min(e2 + context, editLines.length);

        mergeWithNext = false;
        if (next) {
            if (end1 >= next.origStart - context) {
                end1 = next.origStart;
                end2 = next.editStart;
                mergeWithNext = true;
            }
        }

        for (var j = start1; j < s1; j++) hunk += "\n " + origLines[j];
        for (var j = s1; j < e1; j++) hunk += "\n-" + origLines[j];
        if (ch == last && editEOF) hunk += "\n\\ No newline at end of file";
        for (var j = s2; j < e2; j++) hunk += "\n+" + editLines[j];
        if (ch == last && origEOF) hunk += "\n\\ No newline at end of file";
        for (var j = e1; j < end1; j++) hunk += "\n " + origLines[j];

        length1 += end1 - start1;
        length2 += end2 - start2;
        if (mergeWithNext) continue;

        patch += "\n" + header(end1 - length1, length1, end2 - length2, length2) + hunk;
        length2 = length1 = 0;
        hunk = "";
    }

    if (!editEOF && !origEOF && end1 == origLines.length) {
        patch += "\n\\ No newline at end of file";
    }

    return patch;
}

// Run the main function
compareDiffs();