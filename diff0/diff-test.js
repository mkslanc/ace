const { execSync } = require("child_process");
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
    const dmp = new diff_match_patch();
    dmp.Diff_Timeout = 0;
    const diffs = dmp.diff_main(oldText, newText, false);
    dmp.diff_cleanupSemantic(diffs);

    const patchLines = [];
    if (diffs.length > 0) {


        let oldLine = 1;
        let newLine = 1;
        let hunkHeaderAdded = false;
        let hunkLines = [];

        diffs.forEach(([type, text]) => {
            const lines = text.split("\n");

            /*if (type === DIFF_EQUAL) {
                lines.forEach((line, index) => {
                    if (line && !hunkHeaderAdded) {
                        patchLines.push(`@@ -${oldLine},${lines.length} +${newLine},${lines.length} @@`);
                        hunkHeaderAdded = true;
                    }
                    if (line) {
                        hunkLines.push(` ${line}`);
                        oldLine++;
                        newLine++;
                    }
                });
            } else */if (type === DIFF_DELETE) {
                lines.forEach((line, index) => {
                    if (line) {
                        if (!hunkHeaderAdded) {
                            patchLines.push(`@@ -${oldLine},${lines.length} +${newLine},${lines.length} @@`);
                            hunkHeaderAdded = true;
                        }
                        hunkLines.push(`-${line}`);
                        oldLine++;
                    }
                });
            } else if (type === DIFF_INSERT) {
                lines.forEach((line, index) => {
                    if (line) {
                        if (!hunkHeaderAdded) {
                            patchLines.push(`@@ -${oldLine},${lines.length} +${newLine},${lines.length} @@`);
                            hunkHeaderAdded = true;
                        }
                        hunkLines.push(`+${line}`);
                        newLine++;
                    }
                });
            }
        });

        if (hunkLines.length > 0) {
            patchLines.push(`diff --git a/${fileName} b/${fileName}`);
            patchLines.push(`--- a/${fileName}`);
            patchLines.push(`+++ b/${fileName}`);
            patchLines.push(...hunkLines);
        }
    }

    return patchLines.join("\n");
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

    const patchLines = [];
    if (changes.length > 0) {
        patchLines.push(`diff --git a/${fileName} b/${fileName}`);
        patchLines.push(`--- a/${fileName}`);
        patchLines.push(`+++ b/${fileName}`);

        changes.forEach(change => {
            const { origStart, origEnd, editStart, editEnd, charChanges } = change;

            // Add hunk header
            const oldRange = `${origStart + 1},${origEnd - origStart}`;
            const newRange = `${editStart + 1},${editEnd - editStart}`;
            patchLines.push(`@@ -${oldRange} +${newRange} @@`);

            // Add line changes
            let oldLineIndex = origStart;
            let newLineIndex = editStart;

            charChanges && charChanges.forEach(charChange => {
                while (oldLineIndex < charChange.originalStartLineNumber) {
                    patchLines.push(` ${oldLines[oldLineIndex]}`);
                    oldLineIndex++;
                    newLineIndex++;
                }

                if (charChange.originalStartLineNumber === charChange.originalEndLineNumber) {
                    // Handle deletions
                    for (let i = charChange.originalStartColumn; i < charChange.originalEndColumn; i++) {
                        patchLines.push(`-${oldLines[charChange.originalStartLineNumber].slice(i)}`);
                    }
                }

                if (charChange.modifiedStartLineNumber === charChange.modifiedEndLineNumber) {
                    // Handle insertions
                    for (let i = charChange.modifiedStartColumn; i < charChange.modifiedEndColumn; i++) {
                        patchLines.push(`+${newLines[charChange.modifiedStartLineNumber].slice(i)}`);
                    }
                }

                oldLineIndex = charChange.originalEndLineNumber;
                newLineIndex = charChange.modifiedEndLineNumber;
            });

            // Add remaining unchanged lines
            while (oldLineIndex < origEnd) {
                patchLines.push(` ${oldLines[oldLineIndex]}`);
                oldLineIndex++;
                newLineIndex++;
            }
        });

    }

    return patchLines.join("\n");
}

// Example usage
// const oldText = `This is the original text.
// It has multiple lines.
// Some lines will be removed.`;

// const newText = `This is the modified text.
// It has multiple lines.
// Some lines will be added.`;

// const fileName = "example.txt";
// const gitDiff = generateGitDiffFromComputeDiff(oldText, newText, fileName);
// console.log(gitDiff);

// // Example usage
// const oldText = `This is the original text.
// It has multiple lines.
// Some lines will be removed.`;

// const newText = `This is the modified text.
// It has multiple lines.
// Some lines will be added.`;

// const fileName = "example.txt";
// const gitDiff = generateGitDiff(oldText, newText, fileName);
// console.log(gitDiff);

// External diff function provided by the user
function userDiff(oldText, newText) {
    // Example implementation of a diff function (replace with the actual user-provided function)
    const jsdiff = require("diff");
    return jsdiff.createPatch("file", oldText, newText);
}

var userDiffs = [generateGitDiffDMP, generateGitDiffFromComputeDiff];

// Helper function to run a git command and return the output
function runGitCommand(command) {
    return execSync(command, { encoding: "utf8" }).trim();
}

// Main function
function compareDiffs() {
    var max = 2;
    const outputDir = path.join(__dirname, "diff_mismatches");
    if (fs.existsSync(outputDir)) {
        fs.rmdirSync(outputDir, { recursive: true, force: true });
    }

    fs.mkdirSync(outputDir);

    // Fetch all commits in the repository history
    const commits = runGitCommand("git rev-list --all").split("\n");

    commits.forEach(commit => {
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
                        const fileOutputDir = path.join(outputDir, `${userDiff.name}___${commit}_${file.replace(/\//g, "_")}`);
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

// Run the main function
compareDiffs();