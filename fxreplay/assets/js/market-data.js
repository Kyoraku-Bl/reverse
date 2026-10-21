/* =========================================================
   KyorakuReplay — market data engine
   Deterministic, procedurally generated candles for every
   instrument. No network calls: the same symbol + timeframe
   always produces the same series, so drawings, sessions and
   backtests stay reproducible.
   ========================================================= */
(function (global) {
  "use strict";

  var TF = {
    "1s": 1000,
    "1m": 60000,
    "5m": 300000,
    "15m": 900000,
    "1H": 3600000,
    "4H": 14400000,
    "1D": 86400000
  };
  var TF_VOL = { "1s": 0.13, "1m": 1, "5m": 1.9, "15m": 3, "1H": 5.5, "4H": 9, "1D": 14 };
  var TF_LIST = ["1m", "5m", "15m", "1H", "4H", "1D"];

  /* ---------------------------------------------------------
     Instrument catalogue
     [id, label, name, market, base, digits, tick, multiplier,
      volatility, stop-distance, spread, icon, venue]
  --------------------------------------------------------- */
  var DEFS = [
    /* ---- Forex majors & crosses ---- */
    ["EURUSD", "EUR/USD", "Euro / US Dollar", "Forex", 1.0842, 5, 0.00001, 100000, 0.00013, 0.0020, 0.00003, "€", "FX"],
    ["GBPUSD", "GBP/USD", "British Pound / US Dollar", "Forex", 1.2718, 5, 0.00001, 100000, 0.00016, 0.0024, 0.00004, "£", "FX"],
    ["USDJPY", "USD/JPY", "US Dollar / Japanese Yen", "Forex", 156.42, 3, 0.001, 100000, 0.00018, 0.28, 0.004, "¥", "FX"],
    ["USDCHF", "USD/CHF", "US Dollar / Swiss Franc", "Forex", 0.8842, 5, 0.00001, 100000, 0.00012, 0.0018, 0.00003, "Fr", "FX"],
    ["USDCAD", "USD/CAD", "US Dollar / Canadian Dollar", "Forex", 1.3642, 5, 0.00001, 100000, 0.00012, 0.0020, 0.00003, "C$", "FX"],
    ["AUDUSD", "AUD/USD", "Australian Dollar / US Dollar", "Forex", 0.6612, 5, 0.00001, 100000, 0.00016, 0.0019, 0.00003, "A$", "FX"],
    ["NZDUSD", "NZD/USD", "New Zealand Dollar / US Dollar", "Forex", 0.6112, 5, 0.00001, 100000, 0.00017, 0.0019, 0.00004, "NZ$", "FX"],
    ["EURGBP", "EUR/GBP", "Euro / British Pound", "Forex", 0.8524, 5, 0.00001, 100000, 0.00010, 0.0016, 0.00004, "€", "FX"],
    ["EURJPY", "EUR/JPY", "Euro / Japanese Yen", "Forex", 169.54, 3, 0.001, 100000, 0.00016, 0.30, 0.006, "€", "FX"],
    ["GBPJPY", "GBP/JPY", "British Pound / Japanese Yen", "Forex", 199.85, 3, 0.001, 100000, 0.00020, 0.38, 0.008, "£", "FX"],
    ["AUDJPY", "AUD/JPY", "Australian Dollar / Japanese Yen", "Forex", 103.42, 3, 0.001, 100000, 0.00018, 0.30, 0.006, "A$", "FX"],
    ["EURAUD", "EUR/AUD", "Euro / Australian Dollar", "Forex", 1.6392, 5, 0.00001, 100000, 0.00016, 0.0030, 0.00006, "€", "FX"],
    ["GBPAUD", "GBP/AUD", "British Pound / Australian Dollar", "Forex", 1.9242, 5, 0.00001, 100000, 0.00018, 0.0034, 0.00007, "£", "FX"],
    ["USDSEK", "USD/SEK", "US Dollar / Swedish Krona", "Forex", 10.642, 4, 0.0001, 100000, 0.00022, 0.020, 0.0004, "kr", "FX"],
    ["USDNOK", "USD/NOK", "US Dollar / Norwegian Krone", "Forex", 10.842, 4, 0.0001, 100000, 0.00024, 0.022, 0.0005, "kr", "FX"],
    ["USDMXN", "USD/MXN", "US Dollar / Mexican Peso", "Forex", 18.642, 4, 0.0001, 100000, 0.00038, 0.048, 0.0012, "MX$", "FX"],
    ["USDZAR", "USD/ZAR", "US Dollar / South African Rand", "Forex", 18.242, 4, 0.0001, 100000, 0.00042, 0.052, 0.0014, "R", "FX"],
    ["USDSGD", "USD/SGD", "US Dollar / Singapore Dollar", "Forex", 1.3424, 5, 0.00001, 100000, 0.00011, 0.0016, 0.00004, "S$", "FX"],
    ["EURCHF", "EUR/CHF", "Euro / Swiss Franc", "Forex", 0.9584, 5, 0.00001, 100000, 0.00009, 0.0012, 0.00004, "€", "FX"],
    ["GBPCHF", "GBP/CHF", "British Pound / Swiss Franc", "Forex", 1.1242, 5, 0.00001, 100000, 0.00014, 0.0019, 0.00006, "£", "FX"],

    /* ---- Indices (CFD style) ---- */
    ["NAS100", "NAS100", "Nasdaq 100", "Indices", 20142.5, 1, 0.1, 1, 0.00045, 24, 1.4, "NQ", "IDX"],
    ["SPX500", "SPX500", "S&P 500", "Indices", 5421.2, 1, 0.1, 1, 0.00032, 14, 0.6, "ES", "IDX"],
    ["US30", "US30", "Dow Jones 30", "Indices", 39412.0, 1, 1, 1, 0.00030, 90, 2.4, "YM", "IDX"],
    ["US2000", "US2000", "Russell 2000", "Indices", 2042.4, 1, 0.1, 1, 0.00040, 8, 0.6, "RTY", "IDX"],
    ["GER40", "GER40", "DAX 40", "Indices", 18242.5, 1, 0.1, 1, 0.00038, 60, 1.2, "DAX", "IDX"],
    ["UK100", "UK100", "FTSE 100", "Indices", 8242.4, 1, 0.1, 1, 0.00028, 26, 1.0, "FTSE", "IDX"],
    ["FRA40", "FRA40", "CAC 40", "Indices", 7542.2, 1, 0.1, 1, 0.00034, 28, 1.0, "CAC", "IDX"],
    ["JP225", "JP225", "Nikkei 225", "Indices", 38424.0, 1, 1, 1, 0.00036, 160, 6, "NKY", "IDX"],
    ["AUS200", "AUS200", "ASX 200", "Indices", 7842.2, 1, 0.1, 1, 0.00026, 22, 1.0, "ASX", "IDX"],
    ["HK50", "HK50", "Hang Seng", "Indices", 17424.0, 1, 1, 1, 0.00044, 90, 4, "HSI", "IDX"],

    /* ---- Metals (spot) ---- */
    ["XAUUSD", "XAU/USD", "Gold / US Dollar", "Metals", 2341.6, 2, 0.01, 100, 0.00035, 6.0, 0.22, "Au", "SPOT"],
    ["XAGUSD", "XAG/USD", "Silver / US Dollar", "Metals", 29.42, 3, 0.001, 5000, 0.00055, 0.42, 0.012, "Ag", "SPOT"],
    ["XPTUSD", "XPT/USD", "Platinum / US Dollar", "Metals", 984.2, 2, 0.01, 100, 0.00045, 7.0, 0.8, "Pt", "SPOT"],
    ["XPDUSD", "XPD/USD", "Palladium / US Dollar", "Metals", 1024.5, 2, 0.01, 100, 0.00060, 9.0, 1.2, "Pd", "SPOT"],

    /* ---- Energy (CFD style) ---- */
    ["USOIL", "USOIL", "WTI Crude Oil", "Energy", 78.42, 2, 0.01, 1000, 0.00090, 0.35, 0.02, "WTI", "NYMEX"],
    ["UKOIL", "UKOIL", "Brent Crude Oil", "Energy", 82.42, 2, 0.01, 1000, 0.00088, 0.36, 0.02, "BRN", "ICE"],
    ["NATGAS", "NATGAS", "Natural Gas", "Energy", 2.342, 3, 0.001, 10000, 0.00160, 0.045, 0.004, "NG", "NYMEX"],

    /* ---- Crypto ---- */
    ["BTCUSD", "BTC/USD", "Bitcoin / US Dollar", "Crypto", 64210, 1, 0.1, 1, 0.00120, 620, 12, "₿", "CRYPTO"],
    ["ETHUSD", "ETH/USD", "Ethereum / US Dollar", "Crypto", 3142.5, 2, 0.01, 1, 0.00140, 42, 1.2, "Ξ", "CRYPTO"],
    ["SOLUSD", "SOL/USD", "Solana / US Dollar", "Crypto", 142.42, 2, 0.01, 1, 0.00200, 4.2, 0.08, "◎", "CRYPTO"],
    ["XRPUSD", "XRP/USD", "XRP / US Dollar", "Crypto", 0.5242, 5, 0.00001, 1, 0.00180, 0.016, 0.0004, "✕", "CRYPTO"],
    ["DOGEUSD", "DOGE/USD", "Dogecoin / US Dollar", "Crypto", 0.1242, 5, 0.00001, 1, 0.00220, 0.005, 0.0002, "Ð", "CRYPTO"],
    ["AVAXUSD", "AVAX/USD", "Avalanche / US Dollar", "Crypto", 28.42, 2, 0.01, 1, 0.00210, 1.2, 0.03, "A", "CRYPTO"],
    ["LINKUSD", "LINK/USD", "Chainlink / US Dollar", "Crypto", 14.24, 3, 0.001, 1, 0.00190, 0.6, 0.012, "L", "CRYPTO"],

    /* ---- Futures: equity index (CME / Eurex) ---- */
    ["ES", "ES", "E-mini S&P 500 · CME", "Futures", 5421.25, 2, 0.25, 50, 0.00028, 2.0, 0.25, "ES", "CME"],
    ["MES", "MES", "Micro E-mini S&P 500 · CME", "Futures", 5421.25, 2, 0.25, 5, 0.00028, 2.0, 0.25, "MES", "CME"],
    ["NQ", "NQ", "E-mini Nasdaq 100 · CME", "Futures", 19256.5, 2, 0.25, 20, 0.00042, 5.0, 0.25, "NQ", "CME"],
    ["MNQ", "MNQ", "Micro Nasdaq 100 · CME", "Futures", 19256.5, 2, 0.25, 2, 0.00042, 5.0, 0.25, "MNQ", "CME"],
    ["YM", "YM", "E-mini Dow 30 · CBOT", "Futures", 39412, 0, 1, 5, 0.00028, 90, 1, "YM", "CBOT"],
    ["MYM", "MYM", "Micro Dow 30 · CBOT", "Futures", 39412, 0, 1, 0.5, 0.00028, 90, 1, "MYM", "CBOT"],
    ["RTY", "RTY", "E-mini Russell 2000 · CME", "Futures", 2042.4, 1, 0.1, 50, 0.00038, 3.0, 0.1, "RTY", "CME"],
    ["M2K", "M2K", "Micro Russell 2000 · CME", "Futures", 2042.4, 1, 0.1, 5, 0.00038, 3.0, 0.1, "M2K", "CME"],
    ["FDAX", "FDAX", "DAX 40 Futures · Eurex", "Futures", 18242.5, 1, 0.5, 25, 0.00038, 12.0, 1.0, "DAX", "EUREX"],
    ["FDXM", "FDXM", "Mini DAX · Eurex", "Futures", 18242.5, 1, 0.5, 5, 0.00038, 12.0, 1.0, "FDXM", "EUREX"],
    ["FESX", "FESX", "Euro Stoxx 50 · Eurex", "Futures", 4982.0, 1, 0.5, 10, 0.00032, 14.0, 0.5, "FESX", "EUREX"],
    ["FSXE", "FSXE", "Mini Euro Stoxx 50 · Eurex", "Futures", 4982.0, 1, 0.5, 5, 0.00032, 14.0, 0.5, "FSXE", "EUREX"],
    ["FCE", "FCE", "CAC 40 Futures · Eurex", "Futures", 7542.0, 1, 0.5, 10, 0.00034, 18.0, 1.0, "FCE", "EUREX"],
    ["VX", "VX", "VIX Futures · CBOE", "Futures", 14.24, 2, 0.05, 1000, 0.00220, 0.6, 0.05, "VIX", "CBOE"],
    ["VXM", "VXM", "Mini VIX Futures · CBOE", "Futures", 14.24, 2, 0.05, 100, 0.00220, 0.6, 0.05, "VXM", "CBOE"],

    /* ---- Futures: energy ---- */
    ["CL", "CL", "WTI Crude Oil · NYMEX", "Futures", 78.42, 2, 0.01, 1000, 0.00085, 0.10, 0.01, "CL", "NYMEX"],
    ["MCL", "MCL", "Micro WTI Crude · NYMEX", "Futures", 78.42, 2, 0.01, 100, 0.00085, 0.10, 0.01, "MCL", "NYMEX"],
    ["QM", "QM", "E-mini Crude Oil · NYMEX", "Futures", 78.42, 2, 0.025, 500, 0.00085, 0.10, 0.025, "QM", "NYMEX"],
    ["NG", "NG", "Henry Hub Natural Gas · NYMEX", "Futures", 2.342, 3, 0.001, 10000, 0.00160, 0.045, 0.002, "NG", "NYMEX"],
    ["MNG", "MNG", "Micro Natural Gas · NYMEX", "Futures", 2.342, 3, 0.001, 2500, 0.00160, 0.045, 0.002, "MNG", "NYMEX"],
    ["HO", "HO", "NY Harbor ULSD · NYMEX", "Futures", 2.412, 4, 0.0001, 42000, 0.00095, 0.012, 0.0002, "HO", "NYMEX"],
    ["RB", "RB", "RBOB Gasoline · NYMEX", "Futures", 2.312, 4, 0.0001, 42000, 0.00098, 0.012, 0.0002, "RB", "NYMEX"],
    ["BZ", "BZ", "Brent Crude · ICE", "Futures", 82.42, 2, 0.01, 1000, 0.00084, 0.12, 0.01, "BZ", "ICE"],

    /* ---- Futures: metals ---- */
    ["GC", "GC", "Gold Futures · COMEX", "Futures", 2341.6, 1, 0.1, 100, 0.00034, 1.0, 0.1, "GC", "COMEX"],
    ["MGC", "MGC", "Micro Gold · COMEX", "Futures", 2341.6, 1, 0.1, 10, 0.00034, 1.0, 0.1, "MGC", "COMEX"],
    ["SI", "SI", "Silver Futures · COMEX", "Futures", 29.415, 3, 0.005, 5000, 0.00055, 0.20, 0.005, "SI", "COMEX"],
    ["SIL", "SIL", "Micro Silver · COMEX", "Futures", 29.415, 3, 0.005, 1000, 0.00055, 0.20, 0.005, "SIL", "COMEX"],
    ["HG", "HG", "Copper Futures · COMEX", "Futures", 4.4215, 4, 0.0005, 25000, 0.00062, 0.020, 0.0005, "HG", "COMEX"],
    ["MHG", "MHG", "Micro Copper · COMEX", "Futures", 4.4215, 4, 0.0005, 2500, 0.00062, 0.020, 0.0005, "MHG", "COMEX"],
    ["PL", "PL", "Platinum Futures · NYMEX", "Futures", 984.2, 1, 0.1, 50, 0.00045, 4.0, 0.2, "PL", "NYMEX"],
    ["PA", "PA", "Palladium Futures · NYMEX", "Futures", 1024.5, 1, 0.5, 100, 0.00060, 6.0, 0.5, "PA", "NYMEX"],

    /* ---- Futures: rates ---- */
    ["ZB", "ZB", "30-Year T-Bond · CBOT", "Futures", 118.25, 2, 0.03125, 1000, 0.00032, 0.75, 0.03125, "ZB", "CBOT"],
    ["ZN", "ZN", "10-Year T-Note · CBOT", "Futures", 110.15, 2, 0.015625, 1000, 0.00024, 0.35, 0.015625, "ZN", "CBOT"],
    ["ZF", "ZF", "5-Year T-Note · CBOT", "Futures", 105.82, 2, 0.0078125, 1000, 0.00018, 0.22, 0.0078125, "ZF", "CBOT"],
    ["ZT", "ZT", "2-Year T-Note · CBOT", "Futures", 103.12, 2, 0.0078125, 2000, 0.00012, 0.12, 0.0078125, "ZT", "CBOT"],
    ["FGBL", "FGBL", "Euro Bund · Eurex", "Futures", 132.42, 2, 0.01, 1000, 0.00028, 0.60, 0.01, "BUND", "EUREX"],
    ["FGBM", "FGBM", "Euro Bobl · Eurex", "Futures", 118.24, 2, 0.01, 1000, 0.00022, 0.40, 0.01, "BOBL", "EUREX"],

    /* ---- Futures: FX ---- */
    ["6E", "6E", "Euro FX · CME", "Futures", 1.0842, 4, 0.00005, 125000, 0.00013, 0.0020, 0.00005, "6E", "CME"],
    ["6B", "6B", "British Pound · CME", "Futures", 1.2718, 4, 0.0001, 62500, 0.00016, 0.0024, 0.0001, "6B", "CME"],
    ["6J", "6J", "Japanese Yen · CME", "Futures", 0.006425, 6, 0.0000005, 12500000, 0.00018, 0.000028, 0.0000005, "6J", "CME"],
    ["6A", "6A", "Australian Dollar · CME", "Futures", 0.6612, 4, 0.0001, 100000, 0.00016, 0.0019, 0.0001, "6A", "CME"],
    ["6C", "6C", "Canadian Dollar · CME", "Futures", 0.7332, 4, 0.00005, 100000, 0.00012, 0.0020, 0.00005, "6C", "CME"],
    ["6S", "6S", "Swiss Franc · CME", "Futures", 1.1312, 4, 0.0001, 62500, 0.00012, 0.0018, 0.0001, "6S", "CME"],
    ["DX", "DX", "US Dollar Index · ICE", "Futures", 104.24, 3, 0.005, 1000, 0.00014, 0.30, 0.005, "DX", "ICE"],

    /* ---- Futures: grains & softs ---- */
    ["ZC", "ZC", "Corn · CBOT", "Futures", 442.5, 2, 0.25, 50, 0.00085, 4.0, 0.25, "ZC", "CBOT"],
    ["ZS", "ZS", "Soybeans · CBOT", "Futures", 1042.4, 2, 0.25, 50, 0.00080, 10.0, 0.25, "ZS", "CBOT"],
    ["ZW", "ZW", "Chicago Wheat · CBOT", "Futures", 542.8, 2, 0.25, 50, 0.00095, 5.0, 0.25, "ZW", "CBOT"],
    ["ZM", "ZM", "Soybean Meal · CBOT", "Futures", 312.4, 2, 0.1, 100, 0.00090, 3.0, 0.1, "ZM", "CBOT"],
    ["ZL", "ZL", "Soybean Oil · CBOT", "Futures", 42.84, 2, 0.01, 600, 0.00095, 0.40, 0.01, "ZL", "CBOT"],
    ["LE", "LE", "Live Cattle · CME", "Futures", 182.4, 2, 0.025, 400, 0.00060, 1.20, 0.025, "LE", "CME"],
    ["HE", "HE", "Lean Hogs · CME", "Futures", 84.24, 2, 0.025, 400, 0.00085, 1.20, 0.025, "HE", "CME"],
    ["KC", "KC", "Arabica Coffee · ICE", "Futures", 232.4, 2, 0.05, 375, 0.00110, 5.0, 0.05, "KC", "ICE"],
    ["SB", "SB", "Raw Sugar · ICE", "Futures", 18.42, 2, 0.01, 1120, 0.00100, 0.40, 0.01, "SB", "ICE"],
    ["CC", "CC", "Cocoa · ICE", "Futures", 8424, 0, 1, 10, 0.00120, 160, 1, "CC", "ICE"],
    ["CT", "CT", "Cotton · ICE", "Futures", 68.42, 2, 0.01, 500, 0.00100, 1.20, 0.01, "CT", "ICE"],
    ["OJ", "OJ", "Orange Juice · ICE", "Futures", 342.4, 2, 0.05, 150, 0.00130, 5.0, 0.05, "OJ", "ICE"],

    /* ---- Futures: crypto ---- */
    ["BTC", "BTC", "Bitcoin Futures · CME", "Futures", 64210, 0, 5, 5, 0.00120, 900, 5, "₿", "CME"],
    ["MBT", "MBT", "Micro Bitcoin · CME", "Futures", 64210, 0, 5, 0.1, 0.00120, 900, 5, "MBT", "CME"],
    ["MET", "MET", "Micro Ether · CME", "Futures", 3142.5, 2, 0.25, 0.1, 0.00140, 60, 0.25, "Ξ", "CME"]
  ];

  var MARKETS = ["Forex", "Futures", "Indices", "Crypto", "Metals", "Energy"];
  var MARKET_LABEL = {
    Forex: "Forex", Futures: "Futures", Indices: "Indices",
    Crypto: "Crypto", Metals: "Metals", Energy: "Energy"
  };
  var MARKET_ICON = { Forex: "€", Futures: "ES", Indices: "IDX", Crypto: "₿", Metals: "Au", Energy: "CL" };

  var ASSETS = DEFS.map(function (d, i) {
    return {
      id: d[0],
      label: d[1],
      name: d[2],
      market: d[3],
      base: d[4],
      digits: d[5],
      tick: d[6],
      mult: d[7],
      vol: d[8],
      stop: d[9],
      spread: d[10],
      icon: d[11],
      venue: d[12],
      order: i
    };
  });

  var BY_ID = {};
  ASSETS.forEach(function (a) { BY_ID[a.id] = a; });

  /* ---------------------------------------------------------
     Deterministic random helpers
  --------------------------------------------------------- */
  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function roundTo(v, step, digits) {
    var r = Math.round(v / step) * step;
    return +r.toFixed(digits);
  }

  /* ---------------------------------------------------------
     Series
  --------------------------------------------------------- */
  var cache = new Map();
  var BARS = 3000;

  function ema(values, len) {
    var out = new Array(values.length);
    var k = 2 / (len + 1);
    var prev = values[0];
    for (var i = 0; i < values.length; i++) {
      prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  function build(asset, tf) {
    var key = asset.id + ":" + tf;
    if (cache.has(key)) return cache.get(key);
    var step = TF[tf] || TF["1m"];
    var mult = TF_VOL[tf] || 1;
    var rand = mulberry32(hashSeed(key));
    var sig = asset.vol * mult;
    var n = BARS;
    var t0 = Math.floor((Date.now() - n * step) / step) * step;
    var data = new Array(n);
    var price = asset.base * (0.96 + rand() * 0.05);
    var bias = 0;

    /* intraday volatility smile: quiet Asia, loud open/close */
    for (var i = 0; i < n; i++) {
      if (i % 85 === 0) bias = (rand() - 0.46) * sig * 0.9;
      var wave = Math.sin(i / 33) * sig * 0.28 + Math.sin(i / 11) * sig * 0.10;
      var shock = rand() < 0.008 ? (rand() - 0.5) * sig * 7 : 0;
      var revert = -0.05 * Math.log(price / asset.base);
      var ret = bias + wave + (rand() - 0.5) * sig * 1.7 + shock + revert;

      var open = price;
      var close = Math.max(open * (1 + ret), asset.base * 0.35);
      var wick = sig * (0.32 + rand() * 0.95);
      var high = Math.max(open, close) * (1 + rand() * wick);
      var low = Math.min(open, close) * (1 - rand() * wick);

      data[i] = {
        t: t0 + i * step,
        o: roundTo(open, asset.tick, asset.digits),
        h: roundTo(high, asset.tick, asset.digits),
        l: roundTo(low, asset.tick, asset.digits),
        c: roundTo(close, asset.tick, asset.digits),
        v: Math.round((400 + rand() * 1600) * (1 + Math.abs(ret) * 60))
      };
      price = close;
    }

    /* normalise the tail back onto the advertised price so every
       instrument is quoted at a believable level on first open */
    var factor = asset.base / data[n - 1].c;
    for (var j = 0; j < n; j++) {
      var d = data[j];
      d.o = roundTo(d.o * factor, asset.tick, asset.digits);
      d.h = roundTo(d.h * factor, asset.tick, asset.digits);
      d.l = roundTo(d.l * factor, asset.tick, asset.digits);
      d.c = roundTo(d.c * factor, asset.tick, asset.digits);
      if (d.h < Math.max(d.o, d.c)) d.h = Math.max(d.o, d.c);
      if (d.l > Math.min(d.o, d.c)) d.l = Math.min(d.o, d.c);
    }

    var closes = data.map(function (d) { return d.c; });
    var e21 = ema(closes, 21);
    var e50 = ema(closes, 50);

    /* rolling VWAP over 96 bars */
    var vwap = new Array(n);
    var win = 96, pv = 0, vv = 0, queue = [];
    for (var k = 0; k < n; k++) {
      var typical = (data[k].h + data[k].l + data[k].c) / 3;
      var pvt = typical * data[k].v;
      queue.push([pvt, data[k].v]);
      pv += pvt; vv += data[k].v;
      if (queue.length > win) { var out = queue.shift(); pv -= out[0]; vv -= out[1]; }
      vwap[k] = pv / vv;
    }

    var series = {
      asset: asset,
      tf: tf,
      step: step,
      data: data,
      ema21: e21,
      ema50: e50,
      vwap: vwap
    };
    cache.set(key, series);
    return series;
  }

  /* ---------------------------------------------------------
     Formatting / sizing helpers
  --------------------------------------------------------- */
  function fmt(value, digits) {
    var d = digits === undefined ? 2 : digits;
    return Number(value).toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  }
  function pnl(asset, entry, exit, dir, qty) {
    return (exit - entry) * dir * qty * asset.mult;
  }
  function sizeFor(asset, riskUsd) {
    var riskPerUnit = asset.stop * asset.mult;
    return Math.max(0.01, Math.round((riskUsd / riskPerUnit) * 100) / 100);
  }
  function search(query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return ASSETS.slice();
    return ASSETS.filter(function (a) {
      return (a.id + " " + a.label + " " + a.name + " " + a.market + " " + a.venue)
        .toLowerCase().indexOf(q) !== -1;
    });
  }
  function byMarket() {
    var out = {};
    MARKETS.forEach(function (m) { out[m] = []; });
    ASSETS.forEach(function (a) { (out[a.market] = out[a.market] || []).push(a); });
    return out;
  }

  global.KRMarket = {
    ASSETS: ASSETS,
    MARKETS: MARKETS,
    MARKET_LABEL: MARKET_LABEL,
    MARKET_ICON: MARKET_ICON,
    TF: TF,
    TF_LIST: TF_LIST,
    get: function (id) { return BY_ID[id] || ASSETS[0]; },
    series: function (id, tf) { return build(BY_ID[id] || ASSETS[0], tf || "1m"); },
    fmt: fmt,
    pnl: pnl,
    sizeFor: sizeFor,
    search: search,
    byMarket: byMarket,
    hashSeed: hashSeed,
    mulberry32: mulberry32
  };
})(window);
