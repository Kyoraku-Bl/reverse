/* =========================================================
   KyorakuReplay — public symbol map
   Every catalogue instrument -> the ticker it is priced from.
   Shared by the browser (data-provider.js) and by the Node
   snapshot job (scripts/fetch-market-data.mjs), so both always
   agree on where a price comes from.

   "provider:symbol" — the first symbol that resolves wins.
   ========================================================= */
(function (global) {
  "use strict";

  var LIVE = {
    /* ---- Forex (spot, Yahoo FX) ---- */
    EURUSD: "yahoo:EURUSD=X", GBPUSD: "yahoo:GBPUSD=X", USDJPY: "yahoo:USDJPY=X",
    USDCHF: "yahoo:USDCHF=X", USDCAD: "yahoo:USDCAD=X", AUDUSD: "yahoo:AUDUSD=X",
    NZDUSD: "yahoo:NZDUSD=X", EURGBP: "yahoo:EURGBP=X", EURJPY: "yahoo:EURJPY=X",
    GBPJPY: "yahoo:GBPJPY=X", AUDJPY: "yahoo:AUDJPY=X", EURAUD: "yahoo:EURAUD=X",
    GBPAUD: "yahoo:GBPAUD=X", USDSEK: "yahoo:USDSEK=X", USDNOK: "yahoo:USDNOK=X",
    USDMXN: "yahoo:USDMXN=X", USDZAR: "yahoo:USDZAR=X", USDSGD: "yahoo:USDSGD=X",
    EURCHF: "yahoo:EURCHF=X", GBPCHF: "yahoo:GBPCHF=X",

    /* ---- Indices (cash indices) ---- */
    NAS100: "yahoo:^NDX|NQ=F", SPX500: "yahoo:^GSPC|ES=F", US30: "yahoo:^DJI|YM=F", US2000: "yahoo:^RUT|RTY=F",
    GER40: "yahoo:^GDAXI", UK100: "yahoo:^FTSE", FRA40: "yahoo:^FCHI",
    JP225: "yahoo:^N225", AUS200: "yahoo:^AXJO", HK50: "yahoo:^HSI",

    /* ---- Metals (spot, falling back to COMEX futures) ---- */
    XAUUSD: "yahoo:XAUUSD=X|GC=F", XAGUSD: "yahoo:XAGUSD=X|SI=F",
    XPTUSD: "yahoo:XPTUSD=X|PL=F", XPDUSD: "yahoo:XPDUSD=X|PA=F",

    /* ---- Energy (NYMEX / ICE) ---- */
    USOIL: "yahoo:CL=F", UKOIL: "yahoo:BZ=F", NATGAS: "yahoo:NG=F",

    /* ---- Crypto (Binance spot, no key) ---- */
    BTCUSD: "binance:BTCUSDT", ETHUSD: "binance:ETHUSDT", SOLUSD: "binance:SOLUSDT",
    XRPUSD: "binance:XRPUSDT", DOGEUSD: "binance:DOGEUSDT", AVAXUSD: "binance:AVAXUSDT",
    LINKUSD: "binance:LINKUSDT",

    /* ---- Futures: equity index ---- */
    ES: "yahoo:ES=F|^GSPC", MES: "yahoo:MES=F|ES=F",
    NQ: "yahoo:NQ=F|^NDX", MNQ: "yahoo:MNQ=F|NQ=F|^NDX",
    YM: "yahoo:YM=F", MYM: "yahoo:MYM=F|YM=F",
    RTY: "yahoo:RTY=F", M2K: "yahoo:M2K=F|RTY=F",
    FDAX: "yahoo:FDAX=F|^GDAXI", FDXM: "yahoo:FDXM=F|FDAX=F|^GDAXI",
    FESX: "yahoo:FESX=F|^STOXX50E", FSXE: "yahoo:FSXE=F|FESX=F|^STOXX50E",
    FCE: "yahoo:FCE=F|^FCHI",
    VX: "yahoo:^VIX", VXM: "yahoo:^VIX",

    /* ---- Futures: energy ---- */
    CL: "yahoo:CL=F", MCL: "yahoo:MCL=F|CL=F", QM: "yahoo:QM=F|CL=F",
    NG: "yahoo:NG=F", MNG: "yahoo:MNG=F|NG=F",
    HO: "yahoo:HO=F", RB: "yahoo:RB=F", BZ: "yahoo:BZ=F",

    /* ---- Futures: metals ---- */
    GC: "yahoo:GC=F", MGC: "yahoo:MGC=F|GC=F",
    SI: "yahoo:SI=F", SIL: "yahoo:SIL=F|SI=F",
    HG: "yahoo:HG=F", MHG: "yahoo:MHG=F|HG=F",
    PL: "yahoo:PL=F", PA: "yahoo:PA=F",

    /* ---- Futures: rates ---- */
    ZB: "yahoo:ZB=F", ZN: "yahoo:ZN=F", ZF: "yahoo:ZF=F", ZT: "yahoo:ZT=F",
    FGBL: "yahoo:FGBL=F", FGBM: "yahoo:FGBM=F",

    /* ---- Futures: FX ---- */
    "6E": "yahoo:6E=F", "6B": "yahoo:6B=F", "6J": "yahoo:6J=F", "6A": "yahoo:6A=F",
    "6C": "yahoo:6C=F", "6S": "yahoo:6S=F", DX: "yahoo:DX-Y.NYB|DX=F",

    /* ---- Futures: grains & softs ---- */
    ZC: "yahoo:ZC=F", ZS: "yahoo:ZS=F", ZW: "yahoo:ZW=F", ZM: "yahoo:ZM=F", ZL: "yahoo:ZL=F",
    LE: "yahoo:LE=F", HE: "yahoo:HE=F", KC: "yahoo:KC=F", SB: "yahoo:SB=F",
    CC: "yahoo:CC=F", CT: "yahoo:CT=F", OJ: "yahoo:OJ=F",

    /* ---- Futures: crypto ---- */
    BTC: "binance:BTCUSDT", MBT: "binance:BTCUSDT", MET: "binance:ETHUSDT"
  };

  /* Exchange timezone per market, used by the chart's "Exchange" clock. */
  var VENUE_TZ = {
    Forex: "America/New_York",
    Indices: "America/New_York",
    Futures: "America/New_York",
    Crypto: "UTC",
    Metals: "America/New_York",
    Energy: "America/New_York"
  };

  /* Venue name shown in the symbol picker. */
  var VENUE_NAME = {
    Forex: "FX",
    Indices: "Index",
    Futures: "CME",
    Crypto: "Binance",
    Metals: "COMEX",
    Energy: "NYMEX"
  };

  global.KRSymbols = { LIVE: LIVE, VENUE_TZ: VENUE_TZ, VENUE_NAME: VENUE_NAME };
})(typeof window !== "undefined" ? window : globalThis);
