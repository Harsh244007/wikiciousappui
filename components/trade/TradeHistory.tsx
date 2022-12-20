import { I80F48, PerpMarket } from '@blockworks-foundation/mango-v4'
import SideBadge from '@components/shared/SideBadge'
import {
  Table,
  TableDateDisplay,
  Td,
  Th,
  TrBody,
  TrHead,
} from '@components/shared/TableElements'
import { LinkIcon, NoSymbolIcon } from '@heroicons/react/20/solid'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import mangoStore from '@store/mangoStore'
import useMangoAccount from 'hooks/useMangoAccount'
import useSelectedMarket from 'hooks/useSelectedMarket'
import { useMemo } from 'react'
import { formatDecimal } from 'utils/numbers'
import TableMarketName from './TableMarketName'

const byTimestamp = (a: any, b: any) => {
  return (
    new Date(b.loadTimestamp || b.timestamp * 1000).getTime() -
    new Date(a.loadTimestamp || a.timestamp * 1000).getTime()
  )
}

const reverseSide = (side: string) => (side === 'buy' ? 'sell' : 'buy')

const parsedPerpEvent = (mangoAccountPk: PublicKey, event: any) => {
  const maker = event.maker.toString() === mangoAccountPk.toString()
  const orderId = maker ? event.makerOrderId : event.takerOrderId
  const value = event.quantity * event.price
  const feeRate = maker
    ? new I80F48(event.makerFee.val)
    : new I80F48(event.takerFee.val)
  const side = maker ? reverseSide(event.takerSide) : event.takerSide

  return {
    ...event,
    key: orderId?.toString(),
    liquidity: maker ? 'Maker' : 'Taker',
    size: event.size,
    price: event.price,
    value,
    feeCost: (feeRate.toNumber() * value).toFixed(4),
    side,
    marketName: event.marketName,
  }
}

const parsedSerumEvent = (event: any) => {
  let liquidity
  if (event.eventFlags) {
    liquidity = event?.eventFlags?.maker ? 'Maker' : 'Taker'
  } else {
    liquidity = event.maker ? 'Maker' : 'Taker'
  }
  return {
    ...event,
    liquidity,
    key: `${event.maker}-${event.price}`,
    value: event.price * event.size,
    side: event.side,
    marketName: event.marketName,
  }
}

const formatTradeHistory = (mangoAccountPk: PublicKey, tradeHistory: any[]) => {
  return tradeHistory
    .flat()
    .map((event) => {
      if (event.eventFlags || event.nativeQuantityPaid) {
        return parsedSerumEvent(event)
      } else if (event.maker) {
        return parsedPerpEvent(mangoAccountPk, event)
      } else {
        return event
      }
    })
    .sort(byTimestamp)
}

const TradeHistory = () => {
  const { connected } = useWallet()
  const { selectedMarket } = useSelectedMarket()
  const { mangoAccount } = useMangoAccount()
  const fills = mangoStore((s) => s.selectedMarket.fills)

  const openOrderOwner = useMemo(() => {
    if (!mangoAccount || !selectedMarket) return
    try {
      if (selectedMarket instanceof PerpMarket) {
        return mangoAccount.publicKey
      } else {
        return mangoAccount.getSerum3OoAccount(selectedMarket.marketIndex)
          .address
      }
    } catch (e) {
      console.error('Error loading open order account for trade history: ', e)
    }
  }, [mangoAccount, selectedMarket])

  const tradeHistoryFromEventQueue = useMemo(() => {
    if (!mangoAccount || !selectedMarket) return []

    const mangoAccountFills = fills
      .filter((fill: any) => {
        if (fill.openOrders) {
          // handles serum event queue for spot trades
          return openOrderOwner ? fill.openOrders.equals(openOrderOwner) : false
        } else {
          // handles mango event queue for perp trades
          return (
            fill.taker.equals(openOrderOwner) ||
            fill.maker.equals(openOrderOwner)
          )
        }
      })
      .map((fill: any) => ({ ...fill, marketName: selectedMarket.name }))

    return formatTradeHistory(mangoAccount.publicKey, mangoAccountFills)
  }, [selectedMarket, mangoAccount, openOrderOwner])

  if (!selectedMarket) return null

  return connected ? (
    tradeHistoryFromEventQueue.length ? (
      <div>
        <Table>
          <thead>
            <TrHead>
              <Th className="text-left">Market</Th>
              <Th className="text-right">Side</Th>
              <Th className="text-right">Size</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">Value</Th>
              <Th className="text-right">Fee</Th>
              {selectedMarket instanceof PerpMarket ? (
                <Th className="text-right">Time</Th>
              ) : null}
            </TrHead>
          </thead>
          <tbody>
            {tradeHistoryFromEventQueue.map((trade: any) => {
              return (
                <TrBody key={`${trade.marketIndex}`} className="my-1 p-2">
                  <Td className="">
                    <TableMarketName market={selectedMarket} />
                  </Td>
                  <Td className="text-right">
                    <SideBadge side={trade.side} />
                  </Td>
                  <Td className="text-right font-mono">{trade.size}</Td>
                  <Td className="text-right font-mono">
                    {formatDecimal(trade.price)}
                  </Td>
                  <Td className="text-right font-mono">
                    ${trade.value.toFixed(2)}
                  </Td>
                  <Td className="text-right">
                    <span className="font-mono">{trade.feeCost}</span>
                    <span className="text-xs text-th-fgd-4">{`${
                      trade.liquidity ? ` (${trade.liquidity})` : ''
                    }`}</span>
                  </Td>
                  {selectedMarket instanceof PerpMarket ? (
                    <Td className="whitespace-nowrap text-right font-mono">
                      <TableDateDisplay
                        date={trade.timestamp.toNumber() * 1000}
                        showSeconds
                      />
                    </Td>
                  ) : null}
                </TrBody>
              )
            })}
          </tbody>
        </Table>
        <div className="flex flex-col items-center justify-center py-8 px-20">
          <p className="mt-1 rounded border border-th-bkg-3 p-2">
            During the Mango V4 alpha, only your most recent trades will be
            displayed. Full trade history will be available after the alpha
            phase is complete.
          </p>
        </div>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center py-8 px-20">
        <NoSymbolIcon className="mb-2 h-6 w-6 text-th-fgd-4" />
        <p>No trade history for {selectedMarket?.name}</p>
        <p className="mt-4 rounded border border-th-bkg-3 p-2">
          During the Mango V4 alpha, only your recent trades will be displayed.
          Full trade history will be available after the alpha phase is
          complete.
        </p>
      </div>
    )
  ) : (
    <div className="flex flex-col items-center p-8">
      <LinkIcon className="mb-2 h-6 w-6 text-th-fgd-4" />
      <p>Connect to view your trade history</p>
    </div>
  )
}

export default TradeHistory