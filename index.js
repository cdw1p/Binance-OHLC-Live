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
 * Calculates an array of timestamps based on the specified timeframe and lookback.
 * @param {string} timeframe - The timeframe for each timestamp (e.g., '1h', '1d', '1w').
 * @param {number} lookback - The number of timestamps to generate.
 * @returns {number[]} - An array of timestamps.
 */
const getTimeLookback = (timeframe, lookback) => {
  let hoursSequence = []
  const hoursData = { '1h': 1, '2h': 2, '4h': 4, '6h': 6, '8h': 8, '12h': 12, '1d': 24, '3d': 72, '1w': 168, '1M': 720 }
  const hoursInPoint = hoursData[timeframe] * 3600000 * 1000
  const hoursTimeNow = new Date().getTime()
  for (let i = 0; i < lookback; i++) {
    hoursSequence.push(hoursTimeNow - (hoursInPoint * i))
  }
  const hoursMin2015 = new Date('2000-01-01T00:00:00.000Z').getTime()
  hoursSequence = hoursSequence.filter((x) => x > hoursMin2015)
  return hoursSequence
}

/**
 * Retrieves the OHLC data for the specified trading pair and timeframe.
 * @param {string} pair - The trading pair (e.g., 'BTCUSDT', 'ETHUSDT').
 * @param {string} timeframe - The timeframe for each timestamp (e.g., '1h', '1d', '1w').
 * @param {number} lookback - The number of timestamps to generate.
 * @param {string[]} proxy - An array of proxy servers. // If you want to use proxy
 */
getMarketHistory = async (pair, timeframe, lookback, proxy = null) => {
  let proxyData = proxy ? proxy[Math.floor(Math.random() * proxy.length)] : []
  let requestSuccess = false, requestData = []
  while (!(requestSuccess)) {
    try {
      const proxyAgent = new SocksProxyAgent(`socks5://${proxyData}`)
      const binanceUrl = `https://www.binance.me/fapi/v1/markPriceKlines?symbol=${pair}&limit=1000&interval=${timeframe}&endTime=${lookback}`
      const binanceProxy = proxy ? { httpAgent: proxyAgent, httpsAgent: proxyAgent } : ''
      const { status: statusCode, data: dataMarket } = await axios.get(binanceUrl, binanceProxy)
      console.log(`- Fetching Data ${pair} - ${statusCode}`)
      if (statusCode === 200) {
        requestData.push(...dataMarket)
        requestSuccess = true
      }
    } catch (err) {
      proxyData = proxy ? proxy[Math.floor(Math.random() * proxy.length)] : []
      console.log(`ERROR: Failed Fetch Data ${pair} - ${err.message}`)
    }
  }
  return requestData
}

/**
 * Main function that serves as the entry point of the program.
 */
const main = async () => {
  try {
    if (!(fs.existsSync('./data'))) fs.mkdirSync('./data')
    const listPair = ['BTCUSDT', 'ETHUSDT']
    const resListProxy = await getProxyList()
    if (resListProxy) {
      for (let pair of listPair) {
        try {
          const resTimelookback = getTimeLookback(timeframe, 99999)
          for (lookback of resTimelookback) {
            const resMarketHistory = await getMarketHistory(pair, timeframe, lookback, resListProxy)
            if (resMarketHistory.length > 0) {
              const maxDate = new Date().getTime() - (10 * 24 * 60 * 60 * 1000)
              const firstDate = new Date(resMarketHistory[resMarketHistory.length - 1][6]).toISOString().split('T')[0]
              const filename = `./data/${pair}-${timeframe}-${firstDate}.json`
              if (maxDate > firstDate) {
                await fs.writeJson(filename, resMarketHistory)
                console.log(`- Data saved to ${filename}`)
              } else {
                console.log(`- Data already exists for ${pair} at ${filename}`)
                break
              }
            } else {
              break
            }
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