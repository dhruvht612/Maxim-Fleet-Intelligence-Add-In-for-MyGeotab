/**
 * geotab-service.js
 * ---------------------------------------------------------------------------
 * Single access layer for all MyGeotab data.
 *
 * Every part of the add-in reads telematics data through this service — never
 * directly. In mock mode (this showcase build) it serves the generated sample
 * portfolio through the same async signatures the live implementation will
 * use, so wiring in the real MyGeotab API later is a drop-in change confined
 * to this file.
 *
 * Live-mode pattern (MyGeotab Add-In framework):
 *
 *   geotab.addin.maximFleetIntelligence = () => ({
 *     initialize(api, state, done) {
 *       Maxim.service = new Maxim.GeotabService(api);  // api injected by MyGeotab
 *       done();
 *     }
 *   });
 *
 * Each domain method's doc comment records the real Get/Call it maps to.
 * ---------------------------------------------------------------------------
 */
(function (Maxim) {
  'use strict';

  /** Simulated network latency window (ms) so the mock feels like an API. */
  const LATENCY = [90, 320];

  class GeotabService {
    /**
     * @param {object|null} api - The MyGeotab `api` object supplied by the
     *   add-in framework. Pass `null` (or omit) for standalone mock mode.
     */
    constructor(api) {
      this.api = api || null;
      this.live = !!api;
      this.portfolio = null;              // mock data cache
      this.session = null;
    }

    /* ------------------------------------------------------------------ *
     *  Core transport — the three primitives every Geotab call flows through
     * ------------------------------------------------------------------ */

    /**
     * Establish the working session.
     * Live: the api object MyGeotab injects into `initialize()` is already
     * authenticated for the signed-in user — there is no credential login to
     * perform. `api.getSession` captures the session details instead.
     * Mock: resolves a fake session for the demo database.
     */
    async authenticate(server, database, userName, password) {
      if (this.live) {
        return new Promise((resolve, reject) => {
          try {
            this.api.getSession((credentials, srv) => {
              // Older MyGeotab passes (credentials, server); newer passes a
              // single session object that already includes the server.
              this.session = Object.assign({ server: srv }, credentials);
              resolve(this.session);
            });
          } catch (err) {
            reject(err);
          }
        });
      }
      await this._latency();
      this.session = {
        server: server || 'my.geotab.com',
        database: database || 'maxim_demo',
        userName: userName || 'fleet.intel@maximdemo.ca',
        sessionId: 'mock-session-' + Date.now()
      };
      return this.session;
    }

    /**
     * Geotab `Get` — fetch entities of a type.
     * Live: `api.call('Get', { typeName, search, resultsLimit })`.
     */
    async get(typeName, params = {}) {
      if (this.live) {
        return new Promise((resolve, reject) =>
          this.api.call('Get', Object.assign({ typeName }, params), resolve, reject));
      }
      return this._mockGet(typeName, params);
    }

    /**
     * Geotab `Call` — any other API method (Add, Set, GetFeed, custom).
     * Live: `api.call(method, params)`.
     */
    async call(method, params = {}) {
      if (this.live) {
        return new Promise((resolve, reject) =>
          this.api.call(method, params, resolve, reject));
      }
      await this._latency();
      return { method, params, mock: true };
    }

    /* ------------------------------------------------------------------ *
     *  Domain methods — the vocabulary the dashboard is written against
     * ------------------------------------------------------------------ */

    /**
     * Load (or reload) the working dataset.
     * @param {number} [seed] - new seed forces a fresh mock portfolio,
     *   simulating a live re-query of the database.
     */
    async loadPortfolio(seed) {
      if (!this.portfolio || seed !== undefined) {
        await this._latency();
        this.portfolio = Maxim.DataGenerator.generatePortfolio(seed !== undefined ? seed : 20260813);
      }
      return this.portfolio;
    }

    /**
     * All devices/assets with their static properties.
     * Live: Get Device (+ Get Group for the branch/customer hierarchy).
     */
    async getVehicles() {
      const p = await this.loadPortfolio();
      await this._latency();
      return p.vehicles;
    }

    /**
     * Trip aggregates per vehicle over a range.
     * Live: Get Trip { search: { fromDate, toDate, deviceSearch } } — the
     * generator pre-aggregates trips into weekly utilization history.
     */
    async getTrips() {
      const p = await this.loadPortfolio();
      await this._latency();
      return p.vehicles.map(v => ({
        deviceId: v.id, unit: v.unit,
        weeks: p.weeks, utilizationPct: v.utilizationHistory
      }));
    }

    /**
     * Active engine fault codes.
     * Live: Get FaultData { search: { fromDate } } joined to Diagnostic.
     */
    async getFaults() {
      const p = await this.loadPortfolio();
      await this._latency();
      return p.vehicles
        .filter(v => v.faults.length)
        .map(v => ({ deviceId: v.id, unit: v.unit, faults: v.faults }));
    }

    /**
     * Engine measurements (odometer, engine hours, fuel).
     * Live: Get StatusData for DiagnosticOdometerId /
     * DiagnosticEngineHoursId / fuel diagnostics, or the GetFeed stream.
     */
    async getStatusData() {
      const p = await this.loadPortfolio();
      await this._latency();
      return p.vehicles.map(v => ({
        deviceId: v.id, unit: v.unit,
        odometerKm: v.odometerKm, engineHours: v.engineHours,
        fuelL100: v.fuelL100, idlePct: v.idlePct
      }));
    }

    /**
     * Maintenance history and open work.
     * Live: typically an external maintenance-system join; inside Geotab this
     * maps to DVIRLog, DeviceMaintenance rules and reminder records.
     */
    async getMaintenanceData() {
      const p = await this.loadPortfolio();
      await this._latency();
      return p.vehicles.map(v => Object.assign({ deviceId: v.id, unit: v.unit }, v.maintenance));
    }

    /**
     * Drivers and activity summary.
     * Live: Get User { search: { isDriver: true } } + ExceptionEvent rollups.
     * The showcase keeps driver data at the safety-aggregate level.
     */
    async getDrivers() {
      const p = await this.loadPortfolio();
      await this._latency();
      return p.vehicles
        .filter(v => v.powered)
        .map(v => ({ deviceId: v.id, unit: v.unit, harshEvents90d: v.harshEvents90d, dvirDefects90d: v.dvirDefects90d }));
    }

    /**
     * Utilization metrics per asset (30-day rolling).
     * Live: computed from Trip + engine-hour StatusData feeds.
     */
    async getUtilizationMetrics() {
      const p = await this.loadPortfolio();
      await this._latency();
      return p.vehicles.map(v => ({
        deviceId: v.id, unit: v.unit, assetClass: v.assetClass,
        utilization: v.utilization, history: v.utilizationHistory
      }));
    }

    /* ------------------------------------------------------------------ *
     *  Internals
     * ------------------------------------------------------------------ */

    /** Generic mock router for `get(typeName)` calls the demo doesn't model. */
    async _mockGet(typeName) {
      await this._latency();
      switch (typeName) {
        case 'Device':    return this.getVehicles();
        case 'Trip':      return this.getTrips();
        case 'FaultData': return this.getFaults();
        default:          return [];
      }
    }

    _latency() {
      const ms = LATENCY[0] + Math.random() * (LATENCY[1] - LATENCY[0]);
      return new Promise(res => setTimeout(res, ms));
    }
  }

  Maxim.GeotabService = GeotabService;

})(window.Maxim = window.Maxim || {});
