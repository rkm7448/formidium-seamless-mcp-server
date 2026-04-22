import { buildHeaders } from './auth.js';

const BASE_URL = 'https://api.formidium.com';

export class FormidiumClient {
  /**
   * @param {object} config
   * @param {string} config.apiKey
   * @param {string} config.apiSecret
   * @param {string} config.passPhrase
   * @param {string} [config.timeZone]
   * @param {string} [config.baseUrl]
   */
  constructor({ apiKey, apiSecret, passPhrase, timeZone = 'UTC', baseUrl = BASE_URL }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.passPhrase = passPhrase;
    this.timeZone = timeZone;
    this.baseUrl = baseUrl;
  }

  /** Low-level POST helper */
  async post(path, body = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = buildHeaders(this.apiKey, this.apiSecret, this.passPhrase, this.timeZone);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }

    if (!response.ok) {
      const msg = json?.errorObject?.errorMessage || json?.title || `HTTP ${response.status}`;
      throw new Error(`Formidium API error: ${msg}`);
    }

    return json;
  }

  // ─── System ────────────────────────────────────────────────────────────────
  systemHealthCheck() {
    return this.post('/systemHealthCheckUp', {});
  }

  // ─── Funds ─────────────────────────────────────────────────────────────────
  getFundList({ page = 0 } = {}) {
    return this.post('/fundList', { page });
  }

  // ─── Portfolio & Positions ──────────────────────────────────────────────────
  getPortfolioExtract({ fundName, startDate, endDate, page = 0 }) {
    return this.post('/portfolioExtract', { fundName, startDate, endDate, page });
  }

  getPositions({ fundList, date, page = 0 }) {
    return this.post('/positionData', { fundList, date, page });
  }

  getCashAndPositions({ fundList, endDate, page = 0 }) {
    return this.post('/getPortData', { fundList, endDate, page });
  }

  // ─── Performance ───────────────────────────────────────────────────────────
  getPerformance({ fundName, fundList, startDate, endDate, page = 0 }) {
    return this.post('/performanceData', { fundName, fundList, startDate, endDate, page });
  }

  // ─── Financials ────────────────────────────────────────────────────────────
  getBalanceSheet({ fundList, endDate }) {
    return this.post('/balanceSheet', { fundList, endDate });
  }

  getIncomeStatement({ fundList, startDate, endDate }) {
    return this.post('/incomeStatement', { fundList, startDate, endDate });
  }

  // ─── General Ledger ────────────────────────────────────────────────────────
  getLedgerAccountList({ fundName }) {
    return this.post('/ledgerAccount', { fundName });
  }

  getGeneralLedger({ fundName, startDate, endDate, brokerAccountList, nameOfGLAccountList, page = 0 }) {
    return this.post('/generalLedgerWithCustodian', {
      fundName, startDate, endDate, brokerAccountList, nameOfGLAccountList, page,
    });
  }

  getGLAccountNames({ page = 0 } = {}) {
    return this.post('/getGLAccountList', { page });
  }

  // ─── Account Trial Balance ──────────────────────────────────────────────────
  startAccountTrialBalance({ asOfDate, entityList, booksList, glAccountList }) {
    return this.post('/accountTrialBalance', { asOfDate, entityList, booksList, glAccountList });
  }

  getAccountTrialBalanceStatus({ executionId }) {
    return this.post('/accountTrialBalanceStatus', { executionId });
  }

  // ─── Investors ─────────────────────────────────────────────────────────────
  getInvestors({ fund, investorNumber, page = 0 }) {
    return this.post('/getInvestorsData', { fund, investorNumber, page });
  }

  createInvestor({ data }) {
    return this.post('/createInvestors', { data });
  }

  getInvestorAllocation({ fundName, investorNumber, startDate, endDate, frequency = 'all', page = 0 }) {
    return this.post('/investorAllocationAllFrequency', {
      fundName, investorNumber, startDate, endDate, frequency, page,
    });
  }

  getIncomeAllocationSeries({ fundName, startDate, endDate, nameOfGLAccountList, page = 0 }) {
    return this.post('/incomeAllocationSeries', {
      fundName, startDate, endDate, nameOfGLAccountList, page,
    });
  }

  // ─── Trades ────────────────────────────────────────────────────────────────
  getTrades({ fundName, startDate, endDate, custodianBroker, ticker, page = 0 }) {
    return this.post('/getTrades', { fundName, startDate, endDate, custodianBroker, ticker, page });
  }

  createTrade({ data }) {
    return this.post('/createTrades', { data });
  }

  // ─── Non-Trade Transactions ────────────────────────────────────────────────
  getNonTradeTransactions({ fundList, startDate, endDate, page = 0 }) {
    return this.post('/getNonTradeTransactions', { fundList, startDate, endDate, page });
  }

  createNonTradeTransaction({ fundName, transactionTypeName, date, amount, currencyName, exchangeRate, description }) {
    return this.post('/createNonTradeTransactions', {
      fundName, transactionTypeName, date, amount, currencyName, exchangeRate, description,
    });
  }

  // ─── Capital Activities ────────────────────────────────────────────────────
  getCapitalActivities({ fundName, startDate, endDate, transactionType, page = 0 }) {
    return this.post('/getCapitalActivities', { fundName, startDate, endDate, transactionType, page });
  }

  createCapitalActivity({ data }) {
    return this.post('/createCapitalActivities', { data });
  }

  // ─── FX ────────────────────────────────────────────────────────────────────
  getExchangeRates({ fundName, destinationCurrency, startDate, endDate, page = 0 }) {
    return this.post('/exchangeRateData', { fundName, destinationCurrency, startDate, endDate, page });
  }

  // ─── Asset Classes & Custodians ────────────────────────────────────────────
  getAssetClasses({ page = 0 } = {}) {
    return this.post('/assetClass', { page });
  }

  getCustodianAccounts({ fundName }) {
    return this.post('/custodianAccount', { fundName });
  }

  getLookupTypes({ lookupTypes }) {
    return this.post('/getLookupTypes', { lookupTypes });
  }

  // ─── Fees ──────────────────────────────────────────────────────────────────
  getAssetBasedFees({ nameOfFee, page = 0 }) {
    return this.post('/getAssetBaseFee', { nameOfFee, page });
  }

  createAssetBasedFee({ data }) {
    return this.post('/createAssetBaseFee', { data });
  }

  getPerformanceBasedFees({ nameOfFee, page = 0 }) {
    return this.post('/getPerformanceBasedFee', { nameOfFee, page });
  }

  createPerformanceBasedFee({ data }) {
    return this.post('/createPerformanceBasedFee', { data });
  }

  getHurdleTierIncentiveSetups({ hurdleName, page = 0 }) {
    return this.post('/getHurdleTierIncentiveSetup', { hurdleName, page });
  }

  createHurdleTierIncentiveSetup({ data }) {
    return this.post('/createHurdleTierIncentiveSetup', { data });
  }

  // ─── Share Classes & Series ────────────────────────────────────────────────
  getShareClasses({ nameOfClass, page = 0 }) {
    return this.post('/getShareClass', { nameOfClass, page });
  }

  createShareClass({ data }) {
    return this.post('/createShareClass', { data });
  }

  getShareSeries({ seriesName, page = 0 }) {
    return this.post('/getShareSeries', { seriesName, page });
  }

  createShareSeries({ data }) {
    return this.post('/createShareSeries', { data });
  }

  // ─── Reports ───────────────────────────────────────────────────────────────
  getReportCompletionStatus({ fundName } = {}) {
    return this.post('/reportCompletionStatus', { fundName });
  }

  startReport({ reportType, reportParameters }) {
    return this.post('/getReport', { reportType, reportParameters });
  }

  getReportStatus({ executionId }) {
    return this.post('/getReportStatus', { executionId });
  }

  // ─── Batch Reports ─────────────────────────────────────────────────────────
  getBatchRecords({ page = 0 } = {}) {
    return this.post('/getBatchRecords', { page });
  }

  startBatchReport({ batchId, startDate, endDate }) {
    return this.post('/getBatchReports', { batchId, startDate, endDate });
  }

  getBatchExecutionStatus({ executionId }) {
    return this.post('/getBatchExecutionStatus', { executionId });
  }
}
