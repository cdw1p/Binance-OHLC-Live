const axios = require('axios')
const fs = require('fs-extra')
const { SocksProxyAgent } = require('socks-proxy-agent')

/**
 * Arguments passed to the program.
 */
const timeframe = process.argv[2] || '1h'

/**
 * Retrieves a list of proxy servers from a remote source.
 * @returns {Promise<Array<string>|boolean>} A promise that resolves to an array of proxy servers or false if an error occurs.
 */
const getProxyList = async () => new Promise(async (resolve, reject) => {
  try {
    const { status, data } = await axios.get('https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt')
    if (status === 200) {
      resolve(data.split('\r\n'))
    } else {
      resolve(false)
    }
  } catch (err) {
    resolve(false)
  }
})

/**
 * Fetches market data from Binance API.
 * @param {string} pair - The trading pair symbol.
 * @param {string} timeframe - The interval of the data (e.g., '1m', '5m', '1h').
 * @param {number} lookback - The number of intervals to look back.
 * @param {string} proxy - The proxy server to use for the request.
 * @returns {Promise<Object>} - The response object containing the status code and market data.
 */
getMarketHistory = async (pair, timeframe, lookback = 1, proxy) => {
  const hoursSequence = [], ohlcDataSequence = []
  const hoursData = { '1h': 1, '2h': 2, '4h': 4, '6h': 6, '8h': 8, '12h': 12, '1d': 24, '3d': 72, '1w': 168, '1M': 720 }
  const hoursInPoint = hoursData[timeframe] * 3600000 * 1000
  const hoursTimeNow = new Date().getTime()
  for (let i = 0; i < lookback; i++) {
    hoursSequence.push(hoursTimeNow - (hoursInPoint * i))
  }
  let proxyData = proxy[Math.floor(Math.random() * proxy.length)]
  for (let hours of hoursSequence) {
    let requestSuccess = false
    while (!(requestSuccess)) {
      try {
        const proxyAgent = new SocksProxyAgent(`socks5://${proxyData}`)
        const binanceUrl = `https://www.binance.me/fapi/v1/markPriceKlines?symbol=${pair}&limit=1000&interval=${timeframe}&endTime=${hours}`
        console.log(`Connecting to ${binanceUrl} using proxy ${proxyData}`)
        const { status: statusCode, data: dataMarket } = await axios.get(binanceUrl, { httpAgent: proxyAgent, httpsAgent: proxyAgent })
        console.log(dataMarket)
        if (statusCode === 200) {
          if (dataMarket.length > 0) {
            ohlcDataSequence.push(...dataMarket)
          } else {
            break
          }
          requestSuccess = true
        }
      } catch (err) {
        proxyData = proxy[Math.floor(Math.random() * proxy.length)]
        console.log(`ERROR: Failed Fetch Data ${pair} - ${err.message}`)
      }
    }
  }
  return []
}

/**
 * Main function that serves as the entry point of the program.
 */
const main = async () => {
  try {
    const listPair = ['BTCUSDT', 'ETHUSDT']
    const listProxy = await getProxyList()
    if (listProxy) {
      for (let pair of listPair) {
        try {
          const resMarketData = await getMarketHistory(pair, timeframe, 99999, listProxy)
          if (resMarketData.length > 0) {
            if (!(fs.existsSync('./data'))) {
              await fs.mkdirSync('./data')
            }
            await fs.writeJsonSync(`./data/${pair}-${timeframe}.json`, resMarketData, { spaces: 2 })
          }
        } catch (err) {
          console.error(`ERROR: Failed to fetch market history data for ${pair}: ${err.message}`)
        }
      }
    } else {
      console.error('ERROR: Failed to fetch proxy list')
    }
  } catch (err) {
    console.error(err)
  }
}

/**
 * Run the main function
 */
main()