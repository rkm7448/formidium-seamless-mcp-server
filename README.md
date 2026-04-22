# Formidium Seamless MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes the full **Formidium Seamless** Fund Administration API as tools for Claude and other MCP-compatible AI clients.

---

## Prerequisites

- **Node.js 18+** (uses native `fetch` and ES modules)
- A Formidium Seamless account with **API access** enabled
- Your **API Key**, **API Secret**, and **Passphrase** (created in Seamless → Settings → API Management)

---

## Installation

```bash
npm install
```

---

## Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
FORMIDIUM_API_KEY=your_api_key_here
FORMIDIUM_API_SECRET=your_api_secret_here
FORMIDIUM_PASSPHRASE=your_passphrase_here

# Optional
FORMIDIUM_TIMEZONE=Asia/Kolkata          # default: UTC
FORMIDIUM_BASE_URL=https://api.formidium.com  # or https://apidev.formidium.com for sandbox
```

---

## Running

```bash
node src/index.js
```

Or with env vars inline:

```bash
FORMIDIUM_API_KEY=xxx FORMIDIUM_API_SECRET=yyy FORMIDIUM_PASSPHRASE=zzz node src/index.js
```

---

## Connecting to Claude Desktop

Add this block to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "formidium": {
      "command": "node",
      "args": ["/absolute/path/to/formidium-mcp/src/index.js"],
      "env": {
        "FORMIDIUM_API_KEY": "your_api_key",
        "FORMIDIUM_API_SECRET": "your_api_secret",
        "FORMIDIUM_PASSPHRASE": "your_passphrase",
        "FORMIDIUM_TIMEZONE": "Asia/Kolkata"
      }
    }
  }
}
```

Config file locations:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

---

## Authentication

The server implements Formidium's **AES-256-CBC signature** scheme:

1. `message = timestamp + apiKey + passPhrase + apiSecret`
2. `derivedKey = PBKDF2(password=apiSecret, salt=passPhrase, SHA-256, 65536 iterations, 32 bytes)`
3. `iv = 16 zero bytes`
4. `signature = Base64(AES-256-CBC(derivedKey, iv, PKCS7(message)))`

A fresh signature + timestamp is generated for **every request** (signatures expire after 5 seconds per Formidium's spec).

---

## Available Tools (43 total)

### System
| Tool | Description |
|------|-------------|
| `formidium_system_health_check` | Check API health |

### Funds
| Tool | Description |
|------|-------------|
| `formidium_get_fund_list` | List all funds |

### Portfolio & Positions
| Tool | Description |
|------|-------------|
| `formidium_get_portfolio_extract` | Holdings, PnL, exposures over date range |
| `formidium_get_positions` | Positions as of a date |
| `formidium_get_cash_and_positions` | Cash + positions as of a date |

### Performance
| Tool | Description |
|------|-------------|
| `formidium_get_performance` | RoR (daily/MTD/QTD/YTD/ITD), fees, NAV |

### Financials
| Tool | Description |
|------|-------------|
| `formidium_get_balance_sheet` | Balance sheet |
| `formidium_get_income_statement` | Income statement |

### General Ledger
| Tool | Description |
|------|-------------|
| `formidium_get_ledger_account_list` | GL account list for a fund |
| `formidium_get_general_ledger` | Journal entries with custodian |
| `formidium_get_gl_account_names` | All GL account names |

### Account Trial Balance
| Tool | Description |
|------|-------------|
| `formidium_start_account_trial_balance` | Trigger ATB generation (async) |
| `formidium_get_account_trial_balance_status` | Poll ATB status / get download URL |

### Investors
| Tool | Description |
|------|-------------|
| `formidium_get_investors` | List investors for a fund |
| `formidium_create_investor` | Create/update investors |
| `formidium_get_investor_allocation` | Investor allocation (capital, fees, RoR) |
| `formidium_get_income_allocation_series` | Investor-level income allocation |

### Trades
| Tool | Description |
|------|-------------|
| `formidium_get_trades` | List trades |
| `formidium_create_trade` | Create/update trades |

### Non-Trade Transactions
| Tool | Description |
|------|-------------|
| `formidium_get_non_trade_transactions` | List non-trade transactions |
| `formidium_create_non_trade_transaction` | Create a non-trade transaction |

### Capital Activities
| Tool | Description |
|------|-------------|
| `formidium_get_capital_activities` | List capital activities |
| `formidium_create_capital_activity` | Create subscriptions, redemptions, capital calls, etc. |

### FX
| Tool | Description |
|------|-------------|
| `formidium_get_exchange_rates` | Exchange rate data |

### Reference Data
| Tool | Description |
|------|-------------|
| `formidium_get_asset_classes` | Asset class list |
| `formidium_get_custodian_accounts` | Custodian accounts for a fund |
| `formidium_get_lookup_types` | ExecutingBroker / StrategyList lookups |

### Fees
| Tool | Description |
|------|-------------|
| `formidium_get_asset_based_fees` | Asset-based fee configs |
| `formidium_create_asset_based_fee` | Create/update asset-based fees |
| `formidium_get_performance_based_fees` | Performance-based fee configs |
| `formidium_create_performance_based_fee` | Create/update performance fees |
| `formidium_get_hurdle_tier_incentive_setups` | Hurdle tier configs |
| `formidium_create_hurdle_tier_incentive_setup` | Create/update hurdle tiers |

### Share Classes & Series
| Tool | Description |
|------|-------------|
| `formidium_get_share_classes` | Share class configs |
| `formidium_create_share_class` | Create/update share classes |
| `formidium_get_share_series` | Share series configs |
| `formidium_create_share_series` | Create/update share series |

### Reports (Async)
| Tool | Description |
|------|-------------|
| `formidium_get_report_completion_status` | Last completed report date per fund |
| `formidium_start_report` | Trigger async report generation |
| `formidium_get_report_status` | Poll report status / get download URL |

### Batch Reports (Async)
| Tool | Description |
|------|-------------|
| `formidium_get_batch_records` | List batch report configs |
| `formidium_start_batch_report` | Trigger batch report generation |
| `formidium_get_batch_execution_status` | Poll batch status / get ZIP download URL |

---

## Error Handling

All tools return structured errors. Common Formidium error codes:

| Code | Meaning |
|------|---------|
| 10001 | Invalid/expired timestamp |
| 10002 | Invalid signature (key blocked after repeated failures) |
| 10003 | Invalid API key / permissions |
| 10006 | Fund name not found |
| 10008 | No records found |

---

## Project Structure

```
formidium-mcp/
├── src/
│   ├── auth.js      # AES-256-CBC signature generation
│   ├── client.js    # Formidium API client (all endpoints)
│   └── index.js     # MCP server + all 43 tool definitions
├── .env.example
├── package.json
└── README.md
```
