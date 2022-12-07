import { Bank } from '@blockworks-foundation/mango-v4'
import Change from '@components/shared/Change'
import ChartRangeButtons from '@components/shared/ChartRangeButtons'
import {
  ArrowSmallUpIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/20/solid'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useCoingecko } from 'hooks/useCoingecko'
import parse from 'html-react-parser'
import { useTranslation } from 'next-i18next'
import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { formatFixedDecimals } from 'utils/numbers'
const PriceChart = dynamic(() => import('@components/token/PriceChart'), {
  ssr: false,
})
dayjs.extend(relativeTime)

const DEFAULT_COINGECKO_VALUES = {
  ath: 0,
  atl: 0,
  ath_change_percentage: 0,
  atl_change_percentage: 0,
  ath_date: 0,
  atl_date: 0,
  high_24h: 0,
  circulating_supply: 0,
  fully_diluted_valuation: 0,
  low_24h: 0,
  market_cap: 0,
  max_supply: 0,
  price_change_percentage_24h: 0,
  total_supply: 0,
  total_volume: 0,
}

const CoingeckoStats = ({
  bank,
  coingeckoData,
  coingeckoId,
}: {
  bank: Bank
  coingeckoData: any
  coingeckoId: string
}) => {
  const { t } = useTranslation(['common', 'token'])
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [daysToShow, setDaysToShow] = useState<string>('1')
  const [chartData, setChartData] = useState<{ prices: any[] } | null>(null)
  const [loadChartData, setLoadChartData] = useState(true)
  const { isLoading: loadingPrices, data: coingeckoPrices } = useCoingecko()

  const handleDaysToShow = async (days: string) => {
    if (days !== '1') {
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`
        )
        const data = await response.json()
        setLoadChartData(false)
        setChartData(data)
      } catch {
        setLoadChartData(false)
      }
    }
    setDaysToShow(days)
  }

  const {
    ath,
    atl,
    ath_change_percentage,
    atl_change_percentage,
    ath_date,
    atl_date,
    circulating_supply,
    fully_diluted_valuation,
    market_cap,
    max_supply,
    total_supply,
    total_volume,
  } = coingeckoData ? coingeckoData.market_data : DEFAULT_COINGECKO_VALUES

  const loadingChart = useMemo(() => {
    return daysToShow == '1' ? loadingPrices : loadChartData
  }, [loadChartData, loadingPrices])

  const coingeckoTokenPrices = useMemo(() => {
    if (daysToShow === '1' && coingeckoPrices.length && bank) {
      const tokenPriceData = coingeckoPrices.find(
        (asset) => asset.symbol === bank.name
      )

      if (tokenPriceData) {
        return tokenPriceData.prices
      }
    } else {
      if (chartData && !loadingChart) {
        return chartData.prices
      }
    }
    return []
  }, [coingeckoPrices, bank, daysToShow, chartData, loadingChart])

  return (
    <>
      <div className="border-b border-th-bkg-3 py-4 px-6">
        <h2 className="mb-1 text-xl">About {bank.name}</h2>
        <div className="flex items-end">
          <p
            className={`${
              showFullDesc ? 'h-full' : 'h-5'
            } max-w-[720px] overflow-hidden`}
          >
            {parse(coingeckoData.description.en)}
          </p>
          <span
            className="default-transition flex cursor-pointer items-end font-normal underline hover:text-th-fgd-2 md:hover:no-underline"
            onClick={() => setShowFullDesc(!showFullDesc)}
          >
            {showFullDesc ? 'Less' : 'More'}
            <ArrowSmallUpIcon
              className={`h-5 w-5 ${
                showFullDesc ? 'rotate-360' : 'rotate-180'
              } default-transition`}
            />
          </span>
        </div>
      </div>
      {!loadingChart ? (
        coingeckoTokenPrices.length ? (
          <>
            <div className="mt-4 flex w-full items-center justify-between px-6">
              <h2 className="text-base">{bank.name} Price Chart</h2>
              <ChartRangeButtons
                activeValue={daysToShow}
                names={['24H', '7D', '30D']}
                values={['1', '7', '30']}
                onChange={(v) => handleDaysToShow(v)}
              />
            </div>
            <PriceChart
              daysToShow={parseInt(daysToShow)}
              prices={coingeckoTokenPrices}
            />
          </>
        ) : bank?.name === 'USDC' || bank?.name === 'USDT' ? null : (
          <div className="flex flex-col items-center p-6">
            <ArrowTrendingUpIcon className="h-5 w-5 text-th-fgd-3" />
            <p className="mb-0 text-th-fgd-4">{t('token:chart-unavailable')}</p>
          </div>
        )
      ) : (
        <div className="h-10 w-[104px] animate-pulse rounded bg-th-bkg-3" />
      )}
      <div className="grid grid-cols-1 border-b border-th-bkg-3 md:grid-cols-2">
        <div className="col-span-1 border-y border-th-bkg-3 px-6 py-4 md:col-span-2">
          <h2 className="text-base">{bank.name} Stats</h2>
        </div>
        <div className="col-span-1 border-r border-th-bkg-3 px-6 py-4">
          <div className="flex justify-between pb-4">
            <p>{t('token:market-cap')}</p>
            <p className="font-mono text-th-fgd-2">
              {formatFixedDecimals(market_cap.usd, true)}{' '}
              <span className="text-th-fgd-4">
                #{coingeckoData.market_cap_rank}
              </span>
            </p>
          </div>
          <div className="flex justify-between border-t border-th-bkg-3 py-4">
            <p>{t('token:volume')}</p>
            <p className="font-mono text-th-fgd-2">
              {formatFixedDecimals(total_volume.usd, true)}
            </p>
          </div>
          <div className="flex justify-between border-t border-th-bkg-3 py-4">
            <p>{t('token:all-time-high')}</p>
            <div className="flex flex-col items-end">
              <div className="flex items-center font-mono text-th-fgd-2">
                <span className="mr-2">
                  {formatFixedDecimals(ath.usd, true)}
                </span>
                <Change change={ath_change_percentage.usd} suffix="%" />
              </div>
              <p className="text-xs text-th-fgd-4">
                {dayjs(ath_date.usd).format('MMM, D, YYYY')} (
                {dayjs(ath_date.usd).fromNow()})
              </p>
            </div>
          </div>
          <div className="flex justify-between border-b border-t border-th-bkg-3 py-4 md:border-b-0 md:pb-0">
            <p>{t('token:all-time-low')}</p>
            <div className="flex flex-col items-end">
              <div className="flex items-center font-mono text-th-fgd-2">
                <span className="mr-2">
                  {formatFixedDecimals(atl.usd, true)}
                </span>
                <Change change={atl_change_percentage.usd} suffix="%" />
              </div>
              <p className="text-xs text-th-fgd-4">
                {dayjs(atl_date.usd).format('MMM, D, YYYY')} (
                {dayjs(atl_date.usd).fromNow()})
              </p>
            </div>
          </div>
        </div>
        <div className="col-span-1 px-6 pb-4 md:pt-4">
          {fully_diluted_valuation.usd ? (
            <div className="flex justify-between pb-4">
              <p>{t('token:fdv')}</p>
              <p className="font-mono text-th-fgd-2">
                {formatFixedDecimals(fully_diluted_valuation.usd, true)}
              </p>
            </div>
          ) : null}
          <div
            className={`flex justify-between ${
              fully_diluted_valuation.usd
                ? 'border-t border-th-bkg-3 py-4'
                : 'pb-4'
            }`}
          >
            <p>{t('token:circulating-supply')}</p>
            <p className="font-mono text-th-fgd-2">
              {formatFixedDecimals(circulating_supply)}
            </p>
          </div>
          <div
            className={`flex justify-between border-t border-th-bkg-3 ${
              max_supply ? 'py-4' : 'border-b pt-4 md:pb-4'
            }`}
          >
            <p>{t('token:total-supply')}</p>
            <p className="font-mono text-th-fgd-2">
              {formatFixedDecimals(total_supply)}
            </p>
          </div>
          {max_supply ? (
            <div className="flex justify-between border-t border-th-bkg-3 pt-4">
              <p>{t('token:max-supply')}</p>
              <p className="font-mono text-th-fgd-2">
                {formatFixedDecimals(max_supply)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

export default CoingeckoStats