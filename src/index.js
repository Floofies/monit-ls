#!/usr/bin/env node

import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import Table from 'cli-table3';
import ejs from 'ejs';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchMonitStatus(url) {
	try {
		const statusUrl = url.endsWith('/') ? `${url}_status?format=xml` : `${url}/_status?format=xml`;
		const response = await axios.get(statusUrl, { timeout: 5000 });
		const result = await parseStringPromise(response.data, { explicitArray: false });
		return {
			url,
			success: true,
			data: result.monit
		};
	} catch (err) {
		return {
			url,
			success: false,
			error: err.message
		};
	}
}

function formatStatus(status) {
	const s = parseInt(status);
	if (s === 0) {
		return 'OK';
	}
	return `Error (${s})`;
}

const serviceTypes = [
	"Filesystem",
	"Directory",
	"File",
	"Process",
	"Remote Host",
	"System",
	"FIFO",
	"Program",
	"Network",
];

function formatService(serviceType) {
	return serviceTypes.at(Number(serviceType)) ?? "Unknown";
}

function renderCLI(results) {
	const table = new Table({
		head: ['Host', 'Service', 'Type', 'Status', 'Details'],
		style: { head: ['cyan'] }
	});
	for(const result of results) {
		const hostName = result.success ? (result.data.server.localhostname || result.url) : result.url;
		if (!result.success) {
			table.push([hostName, 'N/A', 'N/A', `Offline: ${result.error}`, 'N/A']);
			return;
		}
		const services = Array.isArray(result.data.service) ? result.data.service : [result.data.service];
		services.forEach((service, index) => {
			let extra = 'N/A';
			if (service.uptime) {
				extra = `Up: ${service.uptime}s`;
			} else if (service.block) {
				extra = `Disk: ${service.block.percent}%`;
			}
			table.push([
				index === 0 ? hostName : '',
				service.name,
				formatService(service.$.type),
				formatStatus(service.status),
				extra
			]);
		});
	}

	return table.toString();
}

async function loadTemplate(templatePath) {
	try {
		return await fs.readFile(templatePath, 'utf8');
	} catch (error) {
		if(error.code === "ENOENT")
			return null;
		else
			throw error;
	}
}

async function renderHTML(results, templatePath) {
	for(const result of results) {
		let hostName;
		if(result.success) {
			if(!Array.isArray(result.data.service)) {
				result.data.service = [result.data.service];
			}
			for(const service of result.data.service) {
				service.$.type = formatService(service.$.type);
			};
			hostName = result.data.server.localhostname ?? result.url;
		} else {
			hostName = result.url;
		}
		result.displayName = `${hostName}${!result.success ? ' (Offline: ' + result.error + ')' : ''}`;
	};
	let template;
	if(templatePath && templatePath.length) {
		template = await loadTemplate(templatePath);
	} else {
		template = await loadTemplate(path.join(__dirname, "default-template.ejs"));
	}
	return ejs.render(template, { results });
}

export default async function monitls(hostnames, format = "json", templatePath = "") {
	const results = await Promise.all(hostnames.map(fetchMonitStatus));
	if (format === "json") {
		return JSON.stringify(results, null, 2);
	} else if (format === "html") {
		return await renderHTML(results, templatePath);
	}
	return renderCLI(results);
}