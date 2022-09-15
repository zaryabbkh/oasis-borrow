import BigNumber from 'bignumber.js'
import { combineLatest, Observable, of } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { AaveReserveDataReply } from './calls/aaveProtocolDataProvider'
import { amountFromWei } from './utils'

export type PreparedAaveReserveData = {
  totalValueLocked: BigNumber
}

type PrepareAaveTVLProps = [AaveReserveDataReply, AaveReserveDataReply, string[]]

export function prepareAaveTotalValueLocked$(
  getAaveStEthReserveData$: Observable<AaveReserveDataReply>,
  getAaveWEthReserveData$: Observable<AaveReserveDataReply>,
  getAaveAssetsPrices$: Observable<string[]>,
): Observable<PreparedAaveReserveData> {
  return combineLatest(
    getAaveStEthReserveData$,
    getAaveWEthReserveData$,
    getAaveAssetsPrices$,
  ).pipe(
    switchMap(
      ([
        STETH_reserveData,
        ETH_reserveData,
        [USDC_ETH_priceString, USDC_STETH_priceString],
      ]: PrepareAaveTVLProps) => {
        /*
          The formula:
          Steth_availableLiquidity* steth/usd -((weth_totalStableDebt + weth_totalVariableDebt)* eth/usd ) = total value locked

          Since AAVE doesn't provide the total value locked, we need to calculate it ourselves.
          We need to get the total value locked in USD, so we need to convert the ETH and STETH values to USD.
          There's no prices in USD in their oracle so im assuming 1 USDC = 1 USD
        */
        const USDC_ETH_price = amountFromWei(new BigNumber(USDC_ETH_priceString), 'ETH') // price of one USDC in ETH
        const ETH_USDC_price = new BigNumber(1).div(USDC_ETH_price) // price of one ETH in USDC
        const STETH_USDC_price = amountFromWei(new BigNumber(USDC_STETH_priceString), 'ETH').times(
          ETH_USDC_price,
        ) // price of one STETH in USDC

        const STETH_availableLiquidity = amountFromWei(
          new BigNumber(STETH_reserveData.availableLiquidity),
          'ETH',
        ) // available liquidity in STETH
        const WETH_totalStableDebt = amountFromWei(
          new BigNumber(ETH_reserveData.totalStableDebt),
          'ETH',
        ) // total stable debt in WETH
        const WETH_totalVariableDebt = amountFromWei(
          new BigNumber(ETH_reserveData.totalVariableDebt),
          'ETH',
        ) // total variable debt in WETH

        const STETH_USDC_availableLiquidity = STETH_availableLiquidity.times(STETH_USDC_price) // available liquidity in STETH in USDC
        const USDC_WETH_debt = WETH_totalStableDebt.plus(WETH_totalVariableDebt).times(
          ETH_USDC_price,
        ) // total debt in WETH in USDC
        const totalValueLocked = STETH_USDC_availableLiquidity.minus(USDC_WETH_debt) // total value locked in USDC

        return of({
          totalValueLocked,
        })
      },
    ),
  )
}
