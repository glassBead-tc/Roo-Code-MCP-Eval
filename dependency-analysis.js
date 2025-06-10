#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Find all package.json files
function findPackageJsonFiles(dir, files = []) {
	const items = fs.readdirSync(dir)

	for (const item of items) {
		const fullPath = path.join(dir, item)
		const stat = fs.statSync(fullPath)

		if (stat.isDirectory() && item !== "node_modules" && item !== ".git" && !item.startsWith(".")) {
			findPackageJsonFiles(fullPath, files)
		} else if (item === "package.json") {
			files.push(fullPath)
		}
	}

	return files
}

function analyzeDependencies() {
	const packageFiles = findPackageJsonFiles(".")
	const dependencyMap = new Map()
	const versionConflicts = []
	const workspaceDeps = new Set()
	const issues = []

	console.log(`Found ${packageFiles.length} package.json files\n`)

	// Collect all dependencies and their versions
	for (const file of packageFiles) {
		try {
			const content = JSON.parse(fs.readFileSync(file, "utf8"))
			const relativePath = path.relative(".", file)

			// Skip .next build files
			if (relativePath.includes(".next/")) continue

			console.log(`Analyzing: ${relativePath}`)

			const deps = { ...content.dependencies, ...content.devDependencies }

			// Check for workspace dependencies
			Object.entries(deps).forEach(([name, version]) => {
				if (version.startsWith("workspace:")) {
					workspaceDeps.add(name)
				}

				if (!dependencyMap.has(name)) {
					dependencyMap.set(name, [])
				}

				dependencyMap.get(name).push({
					version,
					file: relativePath,
					type: content.dependencies?.[name] ? "dependency" : "devDependency",
				})
			})
		} catch (error) {
			console.error(`Error reading ${file}:`, error.message)
		}
	}

	console.log("\n=== DEPENDENCY VERSION CONFLICTS ===")

	// Find version conflicts
	for (const [depName, usages] of dependencyMap.entries()) {
		if (usages.length > 1) {
			const versions = [...new Set(usages.map((u) => u.version))]
			if (versions.length > 1 && !depName.startsWith("@roo-code/")) {
				console.log(`\n${depName}:`)
				usages.forEach((usage) => {
					console.log(`  ${usage.version} in ${usage.file} (${usage.type})`)
				})
				versionConflicts.push({ name: depName, usages })
			}
		}
	}

	console.log("\n=== WORKSPACE DEPENDENCIES ===")
	console.log(Array.from(workspaceDeps).sort().join(", "))

	console.log("\n=== POTENTIAL ISSUES ===")

	// Check for common issues
	const commonIssues = [
		{
			check: () => {
				const typescript = dependencyMap.get("typescript")
				if (typescript) {
					const versions = [...new Set(typescript.map((u) => u.version))]
					if (versions.length > 1) {
						return `TypeScript version mismatch: ${versions.join(", ")}`
					}
				}
				return null
			},
		},
		{
			check: () => {
				const react = dependencyMap.get("react")
				const reactDom = dependencyMap.get("react-dom")
				if (react && reactDom) {
					const reactVersions = [...new Set(react.map((u) => u.version))]
					const reactDomVersions = [...new Set(reactDom.map((u) => u.version))]
					if (
						reactVersions.length !== reactDomVersions.length ||
						reactVersions.some((v, i) => v !== reactDomVersions[i])
					) {
						return `React/ReactDOM version mismatch`
					}
				}
				return null
			},
		},
		{
			check: () => {
				const eslint = dependencyMap.get("eslint")
				if (eslint) {
					const versions = [...new Set(eslint.map((u) => u.version))]
					if (versions.length > 1) {
						return `ESLint version mismatch: ${versions.join(", ")}`
					}
				}
				return null
			},
		},
	]

	commonIssues.forEach(({ check }) => {
		const issue = check()
		if (issue) {
			console.log(`- ${issue}`)
			issues.push(issue)
		}
	})

	console.log("\n=== SUMMARY ===")
	console.log(`Total packages: ${packageFiles.length}`)
	console.log(`Unique dependencies: ${dependencyMap.size}`)
	console.log(`Version conflicts: ${versionConflicts.length}`)
	console.log(`Workspace packages: ${workspaceDeps.size}`)
	console.log(`Issues found: ${issues.length}`)

	return {
		conflicts: versionConflicts,
		issues,
		workspaceDeps: Array.from(workspaceDeps),
		totalPackages: packageFiles.length,
		totalDependencies: dependencyMap.size,
	}
}

// Run analysis
analyzeDependencies()
