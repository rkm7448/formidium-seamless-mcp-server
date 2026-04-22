#!/usr/bin/env node
/**
 * Formidium Seamless MCP Server
 *
 * Exposes every Formidium public API endpoint as an MCP tool.
 *
 * Environment variables (required):
 *   FORMIDIUM_API_KEY
 *   FORMIDIUM_API_SECRET
 *   FORMIDIUM_PASSPHRASE
 *
 * Optional:
 *   FORMIDIUM_TIMEZONE   (default: "UTC")
 *   FORMIDIUM_BASE_URL   (default: "https://api.formidium.com")
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FormidiumClient } from './client.js';

// ─── Config ──────────────────────────────────────────────────────────────────
const {
  FORMIDIUM_API_KEY,
  FORMIDIUM_API_SECRET,
  FORMIDIUM_PASSPHRASE,
  FORMIDIUM_TIMEZONE = 'UTC',
  FORMIDIUM_BASE_URL = 'https://api.formidium.com',
} = process.env;

if (!FORMIDIUM_API_KEY || !FORMIDIUM_API_SECRET || !FORMIDIUM_PASSPHRASE) {
  console.error(
    'Error: FORMIDIUM_API_KEY, FORMIDIUM_API_SECRET, and FORMIDIUM_PASSPHRASE must be set.'
  );
  process.exit(1);
}

const client = new FormidiumClient({
  apiKey: FORMIDIUM_API_KEY,
  apiSecret: FORMIDIUM_API_SECRET,
  passPhrase: FORMIDIUM_PASSPHRASE,
  timeZone: FORMIDIUM_TIMEZONE,
  baseUrl: FORMIDIUM_BASE_URL,
});

// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'formidium-seamless',
  version: '1.0.0',
});

// Helper: wrap every tool handler to produce consistent MCP text responses
function wrap(fn) {
  return async (args) => {
    try {
      const result = await fn(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  };
}

// ─── Shared Zod helpers ───────────────────────────────────────────────────────
const dateStr = z.string().describe("Date in 'yyyy-mm-dd' format");
const pageNum = z.number().int().min(0).default(0).describe('Page number (0-indexed)');
const fundNameStr = z.string().describe('Fund name or fund alias');
const fundListArr = z.array(z.string()).describe('Array of fund names or aliases');

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_system_health_check',
  'Check the health/status of the Formidium Seamless API.',
  {},
  wrap(() => client.systemHealthCheck())
);

// ═════════════════════════════════════════════════════════════════════════════
// FUNDS
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_fund_list',
  'Retrieve the list of all funds available in Formidium Seamless.',
  { page: pageNum },
  wrap(({ page }) => client.getFundList({ page }))
);

// ═════════════════════════════════════════════════════════════════════════════
// PORTFOLIO & POSITIONS
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_portfolio_extract',
  'Get portfolio extract (holdings, PnL, exposures) for a fund over a date range.',
  {
    fundName: fundNameStr.optional(),
    startDate: dateStr.optional(),
    endDate: dateStr,
    page: pageNum,
  },
  wrap(({ fundName, startDate, endDate, page }) =>
    client.getPortfolioExtract({ fundName, startDate, endDate, page })
  )
);

server.tool(
  'formidium_get_positions',
  'Get positions for each symbol as of a specific date across one or more funds.',
  {
    fundList: fundListArr,
    date: dateStr,
    page: pageNum,
  },
  wrap(({ fundList, date, page }) => client.getPositions({ fundList, date, page }))
);

server.tool(
  'formidium_get_cash_and_positions',
  'Get cash and position list for one or more funds as of a date.',
  {
    fundList: fundListArr,
    endDate: dateStr,
    page: pageNum,
  },
  wrap(({ fundList, endDate, page }) => client.getCashAndPositions({ fundList, endDate, page }))
);

// ═════════════════════════════════════════════════════════════════════════════
// PERFORMANCE
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_performance',
  'Get rate of return (daily, MTD, QTD, YTD, ITD), fees, and NAV for funds over a date range. Provide either fundName or fundList.',
  {
    fundName: fundNameStr.optional(),
    fundList: fundListArr.optional(),
    startDate: dateStr,
    endDate: dateStr,
    page: pageNum,
  },
  wrap(({ fundName, fundList, startDate, endDate, page }) =>
    client.getPerformance({ fundName, fundList, startDate, endDate, page })
  )
);

// ═════════════════════════════════════════════════════════════════════════════
// FINANCIALS
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_balance_sheet',
  'Fetch balance sheet data (assets, liabilities, net assets) for funds as of a date.',
  {
    fundList: fundListArr,
    endDate: dateStr,
  },
  wrap(({ fundList, endDate }) => client.getBalanceSheet({ fundList, endDate }))
);

server.tool(
  'formidium_get_income_statement',
  'Fetch income statement (income, expenses, net income) for funds over a date range.',
  {
    fundList: fundListArr,
    startDate: dateStr,
    endDate: dateStr,
  },
  wrap(({ fundList, startDate, endDate }) =>
    client.getIncomeStatement({ fundList, startDate, endDate })
  )
);

// ═════════════════════════════════════════════════════════════════════════════
// GENERAL LEDGER
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_ledger_account_list',
  'Get the list of GL (General Ledger) accounts for a fund.',
  { fundName: fundNameStr },
  wrap(({ fundName }) => client.getLedgerAccountList({ fundName }))
);

server.tool(
  'formidium_get_general_ledger',
  'Get detailed general ledger journal entries for a fund, broker account, and GL account over a date range.',
  {
    fundName: fundNameStr,
    startDate: dateStr,
    endDate: dateStr,
    brokerAccountList: z.array(z.string()).describe('List of broker/custodian account names'),
    nameOfGLAccountList: z.array(z.string()).describe('List of GL account names'),
    page: pageNum,
  },
  wrap(({ fundName, startDate, endDate, brokerAccountList, nameOfGLAccountList, page }) =>
    client.getGeneralLedger({ fundName, startDate, endDate, brokerAccountList, nameOfGLAccountList, page })
  )
);

server.tool(
  'formidium_get_gl_account_names',
  'Get the list of all GL account names available in the system (used for P&L exclusion etc.).',
  { page: pageNum },
  wrap(({ page }) => client.getGLAccountNames({ page }))
);

// ═════════════════════════════════════════════════════════════════════════════
// ACCOUNT TRIAL BALANCE
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_start_account_trial_balance',
  'Trigger generation of an Account Trial Balance report. Returns an executionId; poll status with formidium_get_account_trial_balance_status. The asOfDate must be a quarter-end date (03-31, 06-30, 09-30, or 12-31).',
  {
    asOfDate: dateStr.describe("Quarter-end date e.g. '2023-09-30'"),
    entityList: z.array(z.string()).describe('List of entity names'),
    booksList: z.array(z.string()).describe("List of books e.g. ['Budget', 'Actual']"),
    glAccountList: z.array(z.string()).optional().describe('Optional list of GL accounts to filter'),
  },
  wrap(({ asOfDate, entityList, booksList, glAccountList }) =>
    client.startAccountTrialBalance({ asOfDate, entityList, booksList, glAccountList })
  )
);

server.tool(
  'formidium_get_account_trial_balance_status',
  'Poll the execution status of an Account Trial Balance job. Returns a download URL when complete (valid for 30 minutes).',
  {
    executionId: z.string().describe('executionId returned by formidium_start_account_trial_balance'),
  },
  wrap(({ executionId }) => client.getAccountTrialBalanceStatus({ executionId }))
);

// ═════════════════════════════════════════════════════════════════════════════
// INVESTORS
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_investors',
  'Get investor list for a fund, optionally filtered by investor number.',
  {
    fund: z.array(z.string()).describe('Array of fund names'),
    investorNumber: z.string().optional().describe('Optional investor number filter'),
    page: pageNum,
  },
  wrap(({ fund, investorNumber, page }) => client.getInvestors({ fund, investorNumber, page }))
);

server.tool(
  'formidium_create_investor',
  'Create or update one or more investors. Pass an array of investor objects in the data field.',
  {
    data: z.array(
      z.object({
        investorNumber: z.string(),
        name: z.string(),
        fund: z.string(),
        fundCountry: z.string().optional(),
        phoneNumber: z.string().optional(),
        investorFirstName: z.string().optional(),
        investorLastName: z.string().optional(),
        email: z.string().optional(),
        primaryContact: z.string().optional(),
        primaryContactLastName: z.string().optional(),
        zipCode: z.string().optional(),
        address1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        investorType: z.string().optional().describe('GP, LP, Members, Managing Member, Shareholder, etc.'),
        csdInvestorId: z.string().optional(),
      })
    ),
  },
  wrap(({ data }) => client.createInvestor({ data }))
);

server.tool(
  'formidium_get_investor_allocation',
  'Get investor allocation data (capital, fees, RoR) for a fund over a date range.',
  {
    fundName: fundNameStr.optional(),
    investorNumber: z.string().optional(),
    startDate: dateStr,
    endDate: dateStr,
    frequency: z
      .enum(['daily', 'monthly', 'quarterly', 'yearly', 'inception', 'all'])
      .default('all')
      .describe('Frequency of allocation data'),
    page: pageNum,
  },
  wrap(({ fundName, investorNumber, startDate, endDate, frequency, page }) =>
    client.getInvestorAllocation({ fundName, investorNumber, startDate, endDate, frequency, page })
  )
);

server.tool(
  'formidium_get_income_allocation_series',
  'Get investor-level income allocation (management fees, trading fees, ending capital) for a fund over a date range.',
  {
    fundName: fundNameStr,
    startDate: dateStr,
    endDate: dateStr,
    nameOfGLAccountList: z.array(z.string()).optional().describe('Optional GL accounts to include'),
    page: pageNum,
  },
  wrap(({ fundName, startDate, endDate, nameOfGLAccountList, page }) =>
    client.getIncomeAllocationSeries({ fundName, startDate, endDate, nameOfGLAccountList, page })
  )
);

// ═════════════════════════════════════════════════════════════════════════════
// TRADES
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_trades',
  'Get trade list for one or more funds over a date range, optionally filtered by custodian broker or ticker.',
  {
    fundName: z.array(z.string()).describe('Array of fund names'),
    startDate: dateStr,
    endDate: dateStr,
    custodianBroker: z.array(z.string()).optional(),
    ticker: z.array(z.string()).optional(),
    page: pageNum,
  },
  wrap(({ fundName, startDate, endDate, custodianBroker, ticker, page }) =>
    client.getTrades({ fundName, startDate, endDate, custodianBroker, ticker, page })
  )
);

server.tool(
  'formidium_create_trade',
  'Create or update one or more trades. Use formidium_get_asset_classes to get valid asset class values.',
  {
    data: z.array(
      z.object({
        asstClass: z.string().describe('Asset class — use formidium_get_asset_classes'),
        custodianBroker: z.string(),
        sides: z.enum(['Buy', 'Sell', 'Short Sell', 'Buy to Cover']),
        ticker: z.string(),
        tradeDateTime: dateStr,
        currencyCode: z.string(),
        exchangeRateTrade: z.number(),
        tradePrice: z.number(),
        quantity: z.number(),
        id: z.string().optional().describe('Provide to update an existing trade'),
        commission: z.number().optional(),
        commissionCurrencyCode: z.string().optional(),
        clearingFee: z.number().optional(),
        clearingFeeCurrencyCode: z.string().optional(),
        exchangeFees: z.number().optional(),
        exchangeFeesCurrencyCode: z.string().optional(),
        nfaFees: z.number().optional(),
        nfaFeesCurrencyCode: z.string().optional(),
        occFee: z.number().optional(),
        occFeeCurrencyCode: z.string().optional(),
        osiFees: z.number().optional(),
        osiFeesCurrencyCode: z.string().optional(),
        otherCommission: z.number().optional(),
        otherCommissionCurrencyCode: z.string().optional(),
        cryptofuturescommission: z.number().optional(),
        cryptoFutureCommissionCurrency: z.string().optional(),
        pair: z.string().optional(),
        securityName: z.string().optional(),
        strategy: z.string().optional(),
        executingBroker: z.string().optional(),
        taxLotDate: dateStr.optional(),
        transactionHash: z.string().optional(),
        description: z.string().optional(),
        maturityDate: dateStr.optional(),
      })
    ),
  },
  wrap(({ data }) => client.createTrade({ data }))
);

// ═════════════════════════════════════════════════════════════════════════════
// NON-TRADE TRANSACTIONS
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_non_trade_transactions',
  'Get non-trade transactions (dividends, fees, expenses, etc.) for funds over a date range.',
  {
    fundList: fundListArr.optional(),
    startDate: dateStr.optional(),
    endDate: dateStr.optional(),
    page: pageNum,
  },
  wrap(({ fundList, startDate, endDate, page }) =>
    client.getNonTradeTransactions({ fundList, startDate, endDate, page })
  )
);

server.tool(
  'formidium_create_non_trade_transaction',
  'Create a non-trade transaction (e.g. Redemption, Dividend Income, Admin Fee) for a fund.',
  {
    fundName: fundNameStr,
    transactionTypeName: z.string().describe('Transaction type, e.g. Redemption, Dividend Income'),
    date: dateStr,
    amount: z.string().describe('Amount as string'),
    currencyName: z.string(),
    exchangeRate: z.number().default(1),
    description: z.string().optional(),
  },
  wrap(({ fundName, transactionTypeName, date, amount, currencyName, exchangeRate, description }) =>
    client.createNonTradeTransaction({
      fundName, transactionTypeName, date, amount, currencyName, exchangeRate, description,
    })
  )
);

// ═════════════════════════════════════════════════════════════════════════════
// CAPITAL ACTIVITIES
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_capital_activities',
  'Get capital activities (subscriptions, redemptions, capital calls, distributions) for funds over a date range.',
  {
    fundName: z.array(z.string()),
    startDate: dateStr,
    endDate: dateStr,
    transactionType: z.string().optional(),
    page: pageNum,
  },
  wrap(({ fundName, startDate, endDate, transactionType, page }) =>
    client.getCapitalActivities({ fundName, startDate, endDate, transactionType, page })
  )
);

server.tool(
  'formidium_create_capital_activity',
  'Create a capital activity (subscription, redemption, capital call, distribution, share class update, series update, fee update, etc.).',
  {
    data: z.array(
      z.object({
        fundName: z.string(),
        investorNo: z.string(),
        fundingMethod: z.string().describe('e.g. Cash, In kind'),
        timing: z.string().describe('e.g. Day Begin, Day End'),
        transactionType: z.string().describe(
          'Subscription - First Time | Subscription - Additional | Redemption - Full | Redemption - Partial - by % value of Account | Redemption - Partial by Amount | Redemption - Partial - by share or Unit | Distribution - Return of Capital | Commitment | Distribution - Income | Capital Call | Share Class Update | Series Update | PFee Update | MFee Update | Capital Call - Expense | Capital Call - Others'
        ),
        effectiveDate: dateStr,
        currency: z.string().optional(),
        amount: z.string().optional(),
        sharesForInvestor: z.string().optional(),
        shareClass: z.array(z.string()).optional(),
        series: z.array(z.string()).optional(),
        assetBasedFee: z.string().optional(),
        performanceFee: z.string().optional(),
        perValueOfAc: z.array(z.string()).optional().describe('Required for Redemption - Partial - by % value of Account'),
        reductionInLCF: z.string().optional(),
        fundedCommitmentApplicable: z.string().optional(),
        descriptionNotes: z.string().optional(),
        id: z.string().optional().describe('Provide to update an existing record'),
      })
    ),
  },
  wrap(({ data }) => client.createCapitalActivity({ data }))
);

// ═════════════════════════════════════════════════════════════════════════════
// FX
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_exchange_rates',
  'Get exchange rate data for a destination currency over a date range, optionally filtered by fund.',
  {
    fundName: z.array(z.string()).optional(),
    destinationCurrency: z.string().describe('Currency code, e.g. GBP, EUR'),
    startDate: dateStr,
    endDate: dateStr,
    page: pageNum,
  },
  wrap(({ fundName, destinationCurrency, startDate, endDate, page }) =>
    client.getExchangeRates({ fundName, destinationCurrency, startDate, endDate, page })
  )
);

// ═════════════════════════════════════════════════════════════════════════════
// REFERENCE DATA
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_asset_classes',
  'Get the list of all available asset classes (e.g. Equity, Fixed Income Bonds, Cryptocurrencies).',
  { page: pageNum },
  wrap(({ page }) => client.getAssetClasses({ page }))
);

server.tool(
  'formidium_get_custodian_accounts',
  'Get the custodian/broker account list for a fund.',
  { fundName: fundNameStr },
  wrap(({ fundName }) => client.getCustodianAccounts({ fundName }))
);

server.tool(
  'formidium_get_lookup_types',
  "Get lookup type values such as ExecutingBroker or StrategyList — needed when creating trades.",
  {
    lookupTypes: z
      .array(z.enum(['ExecutingBroker', 'StrategyList']))
      .describe("Array of lookup type names: 'ExecutingBroker', 'StrategyList'"),
  },
  wrap(({ lookupTypes }) => client.getLookupTypes({ lookupTypes }))
);

// ═════════════════════════════════════════════════════════════════════════════
// FEES
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_asset_based_fees',
  'Get asset-based (management) fee configurations by name.',
  {
    nameOfFee: z.array(z.string()).describe('List of fee names'),
    page: pageNum,
  },
  wrap(({ nameOfFee, page }) => client.getAssetBasedFees({ nameOfFee, page }))
);

server.tool(
  'formidium_create_asset_based_fee',
  'Create or update asset-based (management) fee configurations.',
  {
    data: z.array(
      z.object({
        nameOfFee: z.string(),
        feeRatePeriod: z.enum(['Annually', 'Custom', 'Daily', 'Intra-Day', 'Monthly', 'Quarterly', 'Semi-Annually', 'Semi-Monthly', 'Weekly']),
        feeRate: z.array(z.number()),
        calculationPeriod: z.enum(['Annually', 'Custom', 'Daily', 'Intra-Day', 'Monthly', 'Quarterly', 'Semi-Annually', 'Semi-Monthly', 'Weekly']),
        feeBase: z.enum(['Capital', 'Commitment']).optional(),
        dayCountInYear: z.enum(['360', '365']).optional(),
        unduePerformanceFee: z.enum(['Yes', 'No']).optional(),
        includePL: z.enum(['Yes', 'No']).optional(),
        addNotional: z.enum(['Yes', 'No']).optional(),
        proRateForShortPeriod: z.enum(['Yes', 'No']),
      })
    ),
  },
  wrap(({ data }) => client.createAssetBasedFee({ data }))
);

server.tool(
  'formidium_get_performance_based_fees',
  'Get performance-based fee configurations by name.',
  {
    nameOfFee: z.array(z.string()),
    page: pageNum,
  },
  wrap(({ nameOfFee, page }) => client.getPerformanceBasedFees({ nameOfFee, page }))
);

server.tool(
  'formidium_create_performance_based_fee',
  'Create or update performance-based fee configurations.',
  {
    data: z.array(
      z.object({
        nameOfFee: z.string(),
        feeRate: z.array(z.number()).optional(),
        calculationPeriod: z.enum(['Annually', 'Custom', 'Daily', 'Monthly', 'Quarterly', 'Semi-Annually', 'Weekly']),
        pLExclusion: z.array(z.string()).optional(),
        nameOfHurdle: z.string().optional(),
        tieredRate: z.enum(['Yes', 'No']).optional(),
        tier: z
          .array(
            z.object({
              tier: z.string(),
              startRange: z.string(),
              endRange: z.string(),
              feeRate: z.string(),
            })
          )
          .optional(),
        managementFeeExclusion: z.enum(['Yes', 'No']).optional(),
      })
    ),
  },
  wrap(({ data }) => client.createPerformanceBasedFee({ data }))
);

server.tool(
  'formidium_get_hurdle_tier_incentive_setups',
  'Get hurdle tier incentive setup configurations by hurdle name.',
  {
    hurdleName: z.array(z.string()),
    page: pageNum,
  },
  wrap(({ hurdleName, page }) => client.getHurdleTierIncentiveSetups({ hurdleName, page }))
);

server.tool(
  'formidium_create_hurdle_tier_incentive_setup',
  'Create or update hurdle tier incentive setups.',
  {
    data: z.array(
      z.object({
        hurdleName: z.string(),
        hurdleType: z.enum(['Fixed', 'Variable']),
        hurdleRatePeriod: z.enum(['Annually', 'Custom', 'Daily', 'Intra-Day', 'Monthly', 'Quarterly', 'Semi-Annually', 'Semi-Monthly', 'Weekly']),
        calculationPeriod: z.enum(['Annually', 'Custom', 'Daily', 'Intra-Day', 'Monthly', 'Quarterly', 'Semi-Annually', 'Semi-Monthly', 'Weekly']),
        cumulativeHurdleType: z.enum(['Cumulative', 'Non-Cumulative']),
        afterHurdle: z.enum(['AllProfits', 'AfterHurdleprofits']),
        hurdleResetPeriod: z.enum(['Annually', 'Custom', 'Daily', 'Intra-Day', 'Monthly', 'Quarterly', 'Semi-Annually', 'Semi-Monthly', 'Weekly']),
        hurdleIncludePL: z.enum(['Yes', 'No']).optional(),
        returnType: z.enum(['TWR', 'IRR']).optional(),
        hurdleTierRate: z.array(z.number()).optional(),
        hurdlePNLInHurdleBase: z.string().optional(),
      })
    ),
  },
  wrap(({ data }) => client.createHurdleTierIncentiveSetup({ data }))
);

// ═════════════════════════════════════════════════════════════════════════════
// SHARE CLASSES & SERIES
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_share_classes',
  'Get share class configurations by name.',
  {
    nameOfClass: z.array(z.string()),
    page: pageNum,
  },
  wrap(({ nameOfClass, page }) => client.getShareClasses({ nameOfClass, page }))
);

server.tool(
  'formidium_create_share_class',
  'Create or update share class configurations.',
  {
    data: z.array(
      z.object({
        nameOfClass: z.string(),
        baseCurrencyOfClass: z.string(),
      })
    ),
  },
  wrap(({ data }) => client.createShareClass({ data }))
);

server.tool(
  'formidium_get_share_series',
  'Get share series configurations by series name.',
  {
    seriesName: z.array(z.string()),
    page: pageNum,
  },
  wrap(({ seriesName, page }) => client.getShareSeries({ seriesName, page }))
);

server.tool(
  'formidium_create_share_series',
  'Create or update share series configurations.',
  {
    data: z.array(
      z.object({
        seriesName: z.string(),
        shareClass: z.string(),
        seriesDate: dateStr,
      })
    ),
  },
  wrap(({ data }) => client.createShareSeries({ data }))
);

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_report_completion_status',
  'Get the report completion status (last completed date) for one or more funds.',
  {
    fundName: z.array(z.string()).optional(),
  },
  wrap(({ fundName }) => client.getReportCompletionStatus({ fundName }))
);

server.tool(
  'formidium_start_report',
  `Trigger async generation of a Formidium report. Returns an executionId; poll with formidium_get_report_status.

Available reportType values and required reportParameters:
  • BalanceSheet         → { endDate, fundName?, fundList?, fundLevel? }
  • MarginByEquityByFund → { startDate, endDate, fundList }
  • CustodianRecon       → { endDate, fundName }
  • AccountStatement     → { endDate, fundName, Daily?, MTD?, QTD?, YTD?, ITD?, Oath?, displayOptions? }
  • IncomeStatement      → { startDate, endDate, fundList }
  • TradeReport          → { fundName, startDate, endDate, page, custodianBroker?, ticker? }
  • PositionReport       → { date, fundList, page }
  • InvestorAllocation   → { startDate, endDate, page, fundName?, investorNumber?, frequency? }
  • CapitalActivities    → { fundName, startDate, endDate, page, transactionType? }
  • OpenTaxLot           → { startDate, endDate, fundList }  (startDate must equal endDate)`,
  {
    reportType: z
      .enum([
        'BalanceSheet',
        'MarginByEquityByFund',
        'CustodianRecon',
        'AccountStatement',
        'IncomeStatement',
        'TradeReport',
        'PositionReport',
        'InvestorAllocation',
        'CapitalActivities',
        'OpenTaxLot',
      ])
      .describe('The type of report to generate'),
    reportParameters: z
      .record(z.unknown())
      .describe('Parameters object — see tool description for per-reportType requirements'),
  },
  wrap(({ reportType, reportParameters }) =>
    client.startReport({ reportType, reportParameters })
  )
);

server.tool(
  'formidium_get_report_status',
  'Poll the execution status of a report. Returns a download URL (valid 30 minutes) when complete.',
  {
    executionId: z.string().describe('executionId from formidium_start_report'),
  },
  wrap(({ executionId }) => client.getReportStatus({ executionId }))
);

// ═════════════════════════════════════════════════════════════════════════════
// BATCH REPORTS
// ═════════════════════════════════════════════════════════════════════════════
server.tool(
  'formidium_get_batch_records',
  'Get the list of available batch report configurations (batchId, batchName, included reports).',
  { page: pageNum },
  wrap(({ page }) => client.getBatchRecords({ page }))
);

server.tool(
  'formidium_start_batch_report',
  'Trigger generation of a batch report. Returns an executionId; poll with formidium_get_batch_execution_status. Note: reports are retained for 3 days.',
  {
    batchId: z.string().describe('batchId from formidium_get_batch_records'),
    startDate: dateStr,
    endDate: dateStr,
  },
  wrap(({ batchId, startDate, endDate }) => client.startBatchReport({ batchId, startDate, endDate }))
);

server.tool(
  'formidium_get_batch_execution_status',
  'Poll the execution status of a batch report job. Returns a download URL (ZIP, valid 30 minutes) when complete.',
  {
    executionId: z.string().describe('executionId from formidium_start_batch_report'),
  },
  wrap(({ executionId }) => client.getBatchExecutionStatus({ executionId }))
);

// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Formidium Seamless MCP server running on stdio');
