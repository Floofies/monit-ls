# monit-ls

`monit-ls` is a Node.js CLI script designed to fetch status information from Monit hosts and present it in various formats, including human-readable command-line output, JSON, and HTML.

The script uses `ejs` for HTML templating. A basic HTML template is embedded within the script. For more complex HTML reports, you can create a `template.ejs` file in the same directory as `index.js`, and the script will use that instead.

**Features**:
- **Multiple Monit Hosts**: Query status from one or more Monit instances.
- **Flexible Configuration**: Specify Monit host URLs directly via command-line arguments or through a JSON configuration file.
- **Error Handling**: Gracefully handles unreachable Monit hosts or API errors.

**Output Formats**:
- **CLI**: A formatted table for easy readability in the terminal.
- **JSON**: A structured JSON object suitable for programmatic consumption.
- **HTML**: A basic HTML report for web-based viewing.

## Usage

The `monit-ls` script can be executed directly from the project directory, or via the `monit-ls` command.

You can specify Monit hosts in two ways:

1.  **Using the `--hosts` option:** Provide a comma-separated list of Monit URLs. Include authentication credentials (username:password) directly in the URL if required.

    ```bash
    monit-ls --hosts http://user:pass@monit-host1:2812,http://monit-host2:2812
    ```

2.  **Using a configuration file with the `--config` option:** Create a JSON file (e.g., `config.json`) with a `hosts` array.

    `config.json` example:
    ```json
    {
      "hosts": [
        "http://user:pass@monit-host1:2812",
        "http://monit-host2:2812"
      ]
    }
    ```

    Then run the script:
    ```bash
    monit-ls --config config.json
    ```

### Output Formats

Use the `--format` option to choose the output format. The default is `cli`.

*   **CLI (default):**

    ```bash
    monit-ls --hosts http://user:pass@monit-host:2812 --format cli
    ```

    Example output:
    ```
    ┌───────────┬─────────┬──────┬────────┬──────────────┐
    │ Host      │ Service │ Type │ Status │ Uptime/Usage │
    ├───────────┼─────────┼──────┼────────┼──────────────┤
    │ test-host │ apache2 │ 3    │ OK     │ Up: 500s     │
    ├───────────┼─────────┼──────┼────────┼──────────────┤
    │           │ rootfs  │ 5    │ OK     │ Disk: 45.0%  │
    └───────────┴─────────┴──────┴────────┴──────────────┘
    ```

*   **JSON:**

    ```bash
    monit-ls --hosts http://user:pass@monit-host:2812 --format json
    ```

    Example output (truncated):
    ```json
    [
      {
        "url": "http://user:pass@monit-host:2812",
        "success": true,
        "data": {
          "$": { ... },
          "server": { ... },
          "platform": { ... },
          "service": [ { ... }, { ... } ]
        }
      }
    ]
    ```

*   **HTML:**

    ```bash
    monit-ls --hosts http://user:pass@monit-host:2812 --format html
    ```

    This will output HTML content to the console. To save it to a file, use the `--output` option.

### Saving Output to a File

Use the `--output <path>` option to save the generated output to a specified file.

```bash
monit-ls --hosts http://user:pass@monit-host:2812 --format html --output monit_report.html
```

## License

This project is licensed under the ISC License. See the `LICENSE` file for details.
