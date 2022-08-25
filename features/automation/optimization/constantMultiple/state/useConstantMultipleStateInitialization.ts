import { TriggerType } from '@oasisdex/automation'
import { IlkData } from 'blockchain/ilks'
import { InstiVault } from 'blockchain/instiVault'
import { Vault } from 'blockchain/vaults'
import { useAppContext } from 'components/AppContextProvider'
import { TriggersData } from 'features/automation/api/automationTriggersData'
import {
  calculateCollRatioFromMultiple,
  getEligibleMultipliers,
} from 'features/automation/common/helpers'
import { extractAutoBSData } from 'features/automation/common/state/basicBSTriggerData'
import { getConstantMutliplyMinMaxValues } from 'features/automation/optimization/constantMultiple/helpers'
import {
  getConstantMultipleMultipliers,
  getDefaultMultiplier,
} from 'features/automation/optimization/constantMultiple/multipliers'
import { CONSTANT_MULTIPLE_FORM_CHANGE } from 'features/automation/optimization/constantMultiple/state/constantMultipleFormChange'
import {
  extractConstantMultipleData,
  prepareConstantMultipleResetData,
} from 'features/automation/optimization/constantMultiple/state/constantMultipleTriggerData'
import { extractStopLossData } from 'features/automation/protection/stopLoss/state/stopLossTriggerData'
import { useEffect } from 'react'

export const CONSTANT_MULTIPLE_GROUP_TYPE = 1

export const DEFAULT_TARGET_OFFSET = 10

export function useConstantMultipleStateInitialization(
  ilkData: IlkData,
  vault: Vault | InstiVault,
  autoTriggersData: TriggersData,
) {
  const { uiChanges } = useAppContext()

  const stopLossTriggerData = extractStopLossData(autoTriggersData)
  const autoBuyTriggerData = extractAutoBSData({
    triggersData: autoTriggersData,
    triggerType: TriggerType.BasicBuy,
  })
  const constantMultipleTriggerData = extractConstantMultipleData(autoTriggersData)
  const collateralizationRatio = vault.collateralizationRatio.toNumber()

  const { min, max } = getConstantMutliplyMinMaxValues({
    autoBuyTriggerData,
    stopLossTriggerData,
    ilkData,
  })

  const multipliers = getConstantMultipleMultipliers({
    ilk: ilkData.ilk,
    minColRatio: min,
    maxColRatio: max,
  })

  const eligibleMultipliers = getEligibleMultipliers({
    multipliers,
    collateralizationRatio: vault.collateralizationRatio,
    lockedCollateral: vault.lockedCollateral,
    debt: vault.debt,
    debtFloor: ilkData.debtFloor,
    deviation: constantMultipleTriggerData.deviation,
    minTargetRatio: min,
    maxTargetRatio: max,
  })

  const defaultMultiplier =
    getDefaultMultiplier({
      multipliers: eligibleMultipliers,
      minColRatio: min,
      maxColRatio: max,
    }) || multipliers[0] // fallback to not break data preparation

  const defaultCollRatio = calculateCollRatioFromMultiple(defaultMultiplier)

  useEffect(() => {
    uiChanges.publish(CONSTANT_MULTIPLE_FORM_CHANGE, {
      type: 'form-defaults',
      multipliers,
      defaultMultiplier,
      eligibleMultipliers,
      defaultCollRatio,
      minTargetRatio: min,
      maxTargetRatio: max,
    })
    uiChanges.publish(CONSTANT_MULTIPLE_FORM_CHANGE, {
      type: 'is-reset-action',
      isResetAction: false,
    })
    uiChanges.publish(CONSTANT_MULTIPLE_FORM_CHANGE, {
      type: 'reset',
      resetData: prepareConstantMultipleResetData({
        defaultMultiplier,
        defaultCollRatio,
        constantMultipleTriggerData,
      }),
    })
    uiChanges.publish(CONSTANT_MULTIPLE_FORM_CHANGE, {
      type: 'continuous',
      continuous: constantMultipleTriggerData.continuous,
    })
    uiChanges.publish(CONSTANT_MULTIPLE_FORM_CHANGE, {
      type: 'deviation',
      deviation: constantMultipleTriggerData.deviation,
    })
    uiChanges.publish(CONSTANT_MULTIPLE_FORM_CHANGE, {
      type: 'current-form',
      currentForm: 'add',
    })
  }, [collateralizationRatio, stopLossTriggerData.triggerId])

  return constantMultipleTriggerData.isTriggerEnabled
}
