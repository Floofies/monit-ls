#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import Table from 'cli-table3';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const program = new Command();

program
  .name('monit-ls')
  .description('List data from Monit hosts')
  .version('1.0.0')
  .option('-h, --hosts <hosts>', 'Comma-separated list of Monit URLs (e.g., http://user:pass@host:2812)')
  .option('-c, --config <path>', 'Path to a JSON config file containing the list of hosts')
  .option('-f, --format <format>', 'Output format: json, cli, html', 'cli')
  .option('-o, --output <path>', 'File path to save the output')
  .parse(process.argv);

const options = program.opts();

async function getHosts() {
  let hosts = [];
  if (options.hosts) {
    hosts = options.hosts.split(',').map(h => h.trim());
  } else if (options.config) {
    try {
      const config = JSON.parse(fs.readFileSync(options.config, 'utf8'));
      hosts = config.hosts || [];
    } catch (err) {
      console.error(`Error reading config file: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error('Please provide hosts via --hosts or --config');
    program.help();
  }
  return hosts;
}

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
  if (s === 0) return 'OK';
  return `Error (${s})`;
}

function renderCLI(results) {
  const table = new Table({
    head: ['Host', 'Service', 'Type', 'Status', 'Uptime/Usage'],
    style: { head: ['cyan'] }
  });

  for(const res of results) {
    const hostName = res.success ? (res.data.server.localhostname || res.url) : res.url;
    if (!res.success) {
      table.push([hostName, 'N/A', 'N/A', `Offline: ${res.error}`, 'N/A']);
      return;
    }

    const services = Array.isArray(res.data.service) ? res.data.service : [res.data.service];
    services.forEach((service, index) => {
      let extra = 'N/A';
      if (service.uptime) extra = `Up: ${service.uptime}s`;
      else if (service.block) extra = `Disk: ${service.block.percent}%`;
      
      table.push([
        index === 0 ? hostName : '',
        service.name,
        service.$.type,
        formatStatus(service.status),
        extra
      ]);
    });
  }

  return table.toString();
}

async function renderHTML(results) {
  const templatePath = path.join(__dirname, 'template.ejs');
  let template;
  if (fs.existsSync(templatePath)) {
    template = fs.readFileSync(templatePath, 'utf8');
  } else {
    template = `
<!DOCTYPE html>
<html>
<head>
  <title>Monit Status</title>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .status-ok { color: green; font-weight: bold; }
    .status-error { color: red; font-weight: bold; }
    .host-row { background-color: #f9f9f9; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Monit Status Report</h1>
  <p>Generated at: <%= new Date().toLocaleString() %></p>
  <table>
    <thead>
      <tr>
        <th>Host</th>
        <th>Service</th>
        <th>Type</th>
        <th>Status</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      <% results.forEach(res => { %>
        <% const hostName = res.success ? (res.data.server.localhostname || res.url) : res.url; %>
        <tr class="host-row">
          <td colspan="5"><%= hostName %> <%= !res.success ? '(Offline: ' + res.error + ')' : '' %></td>
        </tr>
        <% if (res.success) { %>
          <% const services = Array.isArray(res.data.service) ? res.data.service : [res.data.service]; %>
          <% services.forEach(s => { %>
            <tr>
              <td></td>
              <td><%= s.name %></td>
              <td><%= s.$.type %></td>
              <td class="<%= s.status == '0' ? 'status-ok' : 'status-error' %>">
                <%= s.status == '0' ? 'OK' : 'Error (' + s.status + ')' %>
              </td>
              <td>
                <% if (s.uptime) { %> Uptime: <%= s.uptime %>s <% } %>
                <% if (s.block) { %> Disk: <%= s.block.percent %>% <% } %>
                <% if (s.cpu) { %> CPU: <%= s.cpu.percent %>% <% } %>
                <% if (s.memory) { %> Mem: <%= s.memory.percent %>% <% } %>
              </td>
            </tr>
          <% }); %>
        <% } %>
      <% }); %>
    </tbody>
  </table>
</body>
</html>
    `;
  }
  return ejs.render(template, { results });
}

async function main() {
  const hosts = await getHosts();
  const results = await Promise.all(hosts.map(fetchMonitStatus));

  let output;
  if (options.format === 'json') {
    output = JSON.stringify(results, null, 2);
  } else if (options.format === 'html') {
    output = await renderHTML(results);
  } else {
    output = renderCLI(results);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`Output saved to ${options.output}`);
  } else {
    console.log(output);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
