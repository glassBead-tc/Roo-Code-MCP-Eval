import { execa } from "execa"
import * as fs from "fs/promises"
import * as path from "path"
import { ExerciseLanguage } from "../exercises/index.js"

export interface CodeQualityResult {
	executionSuccess: boolean
	errorCount: number
	testsPassed?: number
	testsTotal?: number
}

/**
 * Assess the quality of generated code by running tests and checking for execution errors
 */
export async function assessCodeQuality(
	taskDirectory: string,
	language: ExerciseLanguage
): Promise<CodeQualityResult> {
	let executionSuccess = false
	let errorCount = 0
	let testsPassed: number | undefined
	let testsTotal: number | undefined

	try {
		// Run language-specific tests based on the exercise language
		switch (language) {
			case "javascript": {
				// Check if package.json exists
				const packageJsonPath = path.join(taskDirectory, "package.json")
				if (await fs.stat(packageJsonPath).catch(() => false)) {
					try {
						// Run npm test and capture output
						const { stdout } = await execa("npm", ["test"], {
							cwd: taskDirectory,
							timeout: 30000,
							reject: false,
						})
						
						// Parse test results from stdout if possible
						// This is a simple example - adjust based on your test runner output
						const passMatch = stdout.match(/(\d+) passing/)
						const failMatch = stdout.match(/(\d+) failing/)
						
						if (passMatch && passMatch[1]) {
							testsPassed = parseInt(passMatch[1])
							testsTotal = testsPassed
							if (failMatch && failMatch[1]) {
								const failed = parseInt(failMatch[1])
								testsTotal += failed
							}
						}
						
						executionSuccess = !failMatch || (failMatch[1] ? parseInt(failMatch[1]) === 0 : true)
					} catch (error) {
						executionSuccess = false
						errorCount = 1
					}
				}
				break
			}
			
			case "python": {
				// Check if any Python files exist
				const pythonFiles = await fs.readdir(taskDirectory)
				const hasPythonFiles = pythonFiles.some(f => f.endsWith('.py'))
				
				if (hasPythonFiles) {
					try {
						// Run pytest and capture output
						const { stdout, exitCode } = await execa("python", ["-m", "pytest", "-v"], {
							cwd: taskDirectory,
							timeout: 30000,
							reject: false,
						})
						
						// Parse pytest output
						const summaryMatch = stdout.match(/(\d+) passed.*?(\d+) failed/)
						if (summaryMatch && summaryMatch[1] && summaryMatch[2]) {
							testsPassed = parseInt(summaryMatch[1])
							const failed = parseInt(summaryMatch[2])
							testsTotal = testsPassed + failed
						} else {
							// Check for all passed
							const allPassedMatch = stdout.match(/(\d+) passed/)
							if (allPassedMatch && allPassedMatch[1]) {
								testsPassed = parseInt(allPassedMatch[1])
								testsTotal = testsPassed
							}
						}
						
						executionSuccess = exitCode === 0
						errorCount = exitCode === 0 ? 0 : 1
					} catch (error) {
						executionSuccess = false
						errorCount = 1
					}
				}
				break
			}
			
			case "go": {
				// Check if go.mod exists
				const goModPath = path.join(taskDirectory, "go.mod")
				if (await fs.stat(goModPath).catch(() => false)) {
					try {
						// Run go test
						const { stdout, exitCode } = await execa("go", ["test", "-v"], {
							cwd: taskDirectory,
							timeout: 30000,
							reject: false,
						})
						
						// Parse go test output
						const passCount = (stdout.match(/PASS:/g) || []).length
						const failCount = (stdout.match(/FAIL:/g) || []).length
						
						if (passCount > 0 || failCount > 0) {
							testsPassed = passCount
							testsTotal = passCount + failCount
						}
						
						executionSuccess = exitCode === 0
						errorCount = failCount
					} catch (error) {
						executionSuccess = false
						errorCount = 1
					}
				}
				break
			}
			
			case "java": {
				// Check if build.gradle exists
				const gradlePath = path.join(taskDirectory, "build.gradle")
				if (await fs.stat(gradlePath).catch(() => false)) {
					try {
						// Run gradle test
						const { stdout, exitCode } = await execa("./gradlew", ["test"], {
							cwd: taskDirectory,
							timeout: 60000,
							reject: false,
						})
						
						// Gradle test results are usually in XML format
						// For now, just check exit code
						executionSuccess = exitCode === 0
						errorCount = exitCode === 0 ? 0 : 1
					} catch (error) {
						executionSuccess = false
						errorCount = 1
					}
				}
				break
			}
			
			case "rust": {
				// Check if Cargo.toml exists
				const cargoPath = path.join(taskDirectory, "Cargo.toml")
				if (await fs.stat(cargoPath).catch(() => false)) {
					try {
						// Run cargo test
						const { stdout, exitCode } = await execa("cargo", ["test"], {
							cwd: taskDirectory,
							timeout: 60000,
							reject: false,
						})
						
						// Parse cargo test output
						const resultMatch = stdout.match(/test result:.*?(\d+) passed.*?(\d+) failed/)
						if (resultMatch && resultMatch[1] && resultMatch[2]) {
							testsPassed = parseInt(resultMatch[1])
							const failed = parseInt(resultMatch[2])
							testsTotal = testsPassed + failed
						}
						
						executionSuccess = exitCode === 0
						errorCount = exitCode === 0 ? 0 : 1
					} catch (error) {
						executionSuccess = false
						errorCount = 1
					}
				}
				break
			}
		}
	} catch (error) {
		console.error("Error assessing code quality:", error)
		executionSuccess = false
		errorCount = 1
	}

	return {
		executionSuccess,
		errorCount,
		testsPassed,
		testsTotal,
	}
}