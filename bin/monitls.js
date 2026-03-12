#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import monitList from "../src/index.js"

const program = new Command();

program.name("monitls")
	.description("List data from Monit hosts")
	.version("1.0.0-gm")
	.argument("[hosts]", "Comma-separated list of Monit URLs (e.g., http://user:pass@host:2812)")
	.option("-h, --hosts <hosts>", "Comma-separated list of Monit URLs (e.g., http://user:pass@host:2812)")
	.option("-c, --config <path>", "Path to a JSON config file containing the list of hosts")
	.option("-f, --format <format>", "Output format: json, table, html", "table")
	.option("-o, --output <path>", "File path to save the output")
	.option("-t, --template <path>", "Path to a custom EJS template for HTML reports")
	.parse(process.argv);

const args = program.args;
const options = program.opts();
try {
	let hostnames;
	let template;
	if(args.length) {
		hostnames = args[0].split(",");
	} else if(options.hosts) {
		hostnames = options.hosts.split(',').map(h => h.trim());
	}
	if(options.config) {
		try {
			const config = JSON.parse(await fs.readFile(options.config, 'utf8'));
			if(!hostnames && ("hosts" in config)) {
				hostnames = config.hosts || [];
			}
			if("template" in config) {
				template = config.template || ""
			}
		} catch (err) {
			console.error(`Error reading config file: ${err.message}`);
			process.exit(1);
		}
	}
	if(!Array.isArray(hostnames) || !hostnames.length) {
		console.error("Please provide hosts via --hosts or --config");
		program.help();
	}
	const output = await monitList(hostnames, options.format, template);
	if (options.output) {
		await fs.writeFile(options.output, output);
	}
	// Toggle between human-friendly output via TTY and pipe-able data output via stdout (API).
	if (process.stdout.isTTY) {
		if (options.output) {
			console.log(`Output saved to ${options.output}`);
		} else {
			console.log(output);
		}
	} else {
		process.stdout.write(output);
	}
} catch (err) {
	console.error(err);
	process.exit(1);
}