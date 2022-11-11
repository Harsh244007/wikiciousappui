import { Transition } from '@headlessui/react'
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  FireIcon,
  PencilIcon,
  PlusCircleIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { Wallet } from '@project-serum/anchor'
import { TokenInstructions } from '@project-serum/serum'
import { useWallet } from '@solana/wallet-adapter-react'
import mangoStore from '@store/mangoStore'
import Decimal from 'decimal.js'
import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { MIN_SOL_BALANCE } from 'utils/constants'
import { notify } from 'utils/notifications'
import { floorToDecimal } from 'utils/numbers'
import ActionTokenList from './account/ActionTokenList'
import ButtonGroup from './forms/ButtonGroup'
import Input from './forms/Input'
import Label from './forms/Label'
import WalletIcon from './icons/WalletIcon'
import { walletBalanceForToken } from './modals/DepositModal'
import ParticlesBackground from './ParticlesBackground'
import Button, { IconButton, LinkButton } from './shared/Button'
import InlineNotification from './shared/InlineNotification'
import Loading from './shared/Loading'
import MaxAmountButton from './shared/MaxAmountButton'
import { handleWalletConnect } from './wallet/ConnectWalletButton'

const UserSetup = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation()
  const group = mangoStore((s) => s.group)
  const { connected, select, wallet, wallets } = useWallet()
  const mangoAccount = mangoStore((s) => s.mangoAccount.current)
  const mangoAccountLoading = mangoStore((s) => s.mangoAccount.initialLoad)
  const [accountName, setAccountName] = useState('')
  const [loadingAccount, setLoadingAccount] = useState(false)
  const [showSetupStep, setShowSetupStep] = useState(0)
  const [depositToken, setDepositToken] = useState('USDC')
  const [depositAmount, setDepositAmount] = useState('')
  const [submitDeposit, setSubmitDeposit] = useState(false)
  const [sizePercentage, setSizePercentage] = useState('')
  // const [showEditProfilePic, setShowEditProfilePic] = useState(false)
  const walletTokens = mangoStore((s) => s.wallet.tokens)

  const solBalance = useMemo(() => {
    return (
      walletTokens.find((t) =>
        t.mint.equals(TokenInstructions.WRAPPED_SOL_MINT)
      )?.uiAmount || 0
    )
  }, [walletTokens])

  const connectWallet = async () => {
    if (wallet) {
      try {
        await handleWalletConnect(wallet)
      } catch (e) {
        notify({
          title: 'Setup failed. Refresh and try again.',
          type: 'error',
        })
      }
    }
  }

  useEffect(() => {
    if (connected) {
      setShowSetupStep(2)
    }
  }, [connected])

  const handleCreateAccount = useCallback(async () => {
    const client = mangoStore.getState().client
    const group = mangoStore.getState().group
    const actions = mangoStore.getState().actions
    if (!group || !wallet) return
    setLoadingAccount(true)
    try {
      const tx = await client.createMangoAccount(
        group,
        0,
        accountName || 'Account 1',
        undefined, // tokenCount
        undefined, // serum3Count
        8, // perpCount
        8 // perpOoCount
      )
      actions.fetchMangoAccounts(wallet!.adapter as unknown as Wallet)
      if (tx) {
        actions.fetchWalletTokens(wallet!.adapter as unknown as Wallet) // need to update sol balance after account rent
        setShowSetupStep(3)
        notify({
          title: t('new-account-success'),
          type: 'success',
          txid: tx,
        })
      }
    } catch (e: any) {
      notify({
        title: t('new-account-failed'),
        txid: e?.signature,
        type: 'error',
      })
      console.error(e)
    } finally {
      setLoadingAccount(false)
    }
  }, [accountName, wallet, t])

  const handleDeposit = useCallback(async () => {
    const client = mangoStore.getState().client
    const group = mangoStore.getState().group
    const actions = mangoStore.getState().actions
    const mangoAccount = mangoStore.getState().mangoAccount.current

    if (!mangoAccount || !group) return
    const bank = group.banksMapByName.get(depositToken)![0]
    try {
      setSubmitDeposit(true)
      const tx = await client.tokenDeposit(
        group,
        mangoAccount,
        bank.mint,
        parseFloat(depositAmount)
      )
      notify({
        title: 'Transaction confirmed',
        type: 'success',
        txid: tx,
      })

      await actions.reloadMangoAccount()
      onClose()
      setSubmitDeposit(false)
    } catch (e: any) {
      notify({
        title: 'Transaction failed',
        description: e.message,
        txid: e?.txid,
        type: 'error',
      })
      setSubmitDeposit(false)
      console.error(e)
    }
  }, [depositAmount, depositToken, onClose])

  useEffect(() => {
    if (mangoAccount && showSetupStep === 2) {
      onClose()
    }
  }, [mangoAccount, showSetupStep, onClose])

  const banks = useMemo(() => {
    const banks = group?.banksMapByName
      ? Array.from(group?.banksMapByName, ([key, value]) => {
          const walletBalance = walletBalanceForToken(walletTokens, key)
          return {
            key,
            value,
            tokenDecimals: walletBalance.maxDecimals,
            walletBalance: floorToDecimal(
              walletBalance.maxAmount,
              walletBalance.maxDecimals
            ).toNumber(),
            walletBalanceValue: walletBalance.maxAmount * value[0]?.uiPrice!,
          }
        })
      : []
    return banks
  }, [group?.banksMapByName, walletTokens])

  const tokenMax = useMemo(() => {
    const bank = banks.find((bank) => bank.key === depositToken)
    if (bank) {
      return { amount: bank.walletBalance, decimals: bank.tokenDecimals }
    }
    return { amount: 0, decimals: 0 }
  }, [banks, depositToken])

  const handleSizePercentage = useCallback(
    (percentage: string) => {
      setSizePercentage(percentage)
      let amount = new Decimal(tokenMax.amount).mul(percentage).div(100)
      if (percentage !== '100') {
        amount = floorToDecimal(amount, tokenMax.decimals)
      }

      setDepositAmount(amount.toString())
    },
    [tokenMax]
  )

  const handleNextStep = () => {
    setShowSetupStep(showSetupStep + 1)
  }

  return (
    <div className="radial-gradient-bg fixed inset-0 z-20 grid overflow-hidden lg:grid-cols-2">
      <img
        className="absolute -bottom-6 right-0 hidden h-auto w-[53%] lg:block xl:w-[57%]"
        src="/images/trade.png"
        alt="next"
      />
      <img
        className={`absolute top-6 left-6 h-10 w-10 flex-shrink-0`}
        src="/logos/logo-mark.svg"
        alt="next"
      />
      <div className="absolute top-0 left-0 z-10 flex h-1.5 w-full flex-grow bg-th-bkg-3">
        <div
          style={{
            width: `${(showSetupStep / 3) * 100}%`,
          }}
          className="flex bg-th-primary transition-all duration-700 ease-out"
        />
      </div>
      <div className="absolute top-6 right-6 z-10">
        <IconButton hideBg onClick={() => onClose()}>
          <XMarkIcon className="h-6 w-6 text-th-fgd-2" />
        </IconButton>
      </div>
      <div className="col-span-1 flex flex-col items-center justify-center p-6 pt-24">
        <Transition
          appear={true}
          className="h-full w-full max-w-md"
          show={showSetupStep === 0}
          enter="transition ease-in duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition ease-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <h2 className="mb-4 text-5xl lg:text-6xl">
            Not your average exchange
          </h2>
          <p className="mb-4 text-base">
            We&apos;ve got DeFi covered. Trade, swap, borrow and lend all of
            your favorite tokens with low fees and lightning execution.
          </p>
          <div className="mb-6 space-y-2 py-3">
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="h-5 w-5 text-th-green" />
              <p className="text-base">
                Fully permissionless and trusted by 1,000s of DeFi users
              </p>
            </div>
            {/* <div className="flex items-center space-x-2">
              <CheckCircleIcon className="h-5 w-5 text-th-green" />
              <p className="text-base">Deeply liquid markets</p>
            </div> */}
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="h-5 w-5 text-th-green" />
              <p className="text-base">
                Up to 20x leverage across 100s of tokens
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="h-5 w-5 text-th-green" />
              <p className="text-base">
                Automatically earn interest on your deposits
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="h-5 w-5 text-th-green" />
              <p className="text-base">
                Borrow 100s of tokens with many collateral options
              </p>
            </div>
          </div>
          <Button className="w-44" onClick={handleNextStep} size="large">
            <div className="flex items-center justify-center">
              <FireIcon className="mr-2 h-5 w-5" />
              {"Let's Go"}
            </div>
          </Button>
        </Transition>
        <Transition
          className="h-full w-full max-w-md"
          show={showSetupStep === 1}
          enter="transition ease-in duration-300 delay-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition ease-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          {showSetupStep === 1 ? (
            <div>
              <h2 className="mb-6 text-5xl lg:text-6xl">Connect Wallet</h2>
              <p className="mb-2 text-base">Choose Wallet</p>
              <div className="space-y-2">
                {wallets?.map((w) => (
                  <button
                    className={`col-span-1 w-full rounded-md border py-3 px-4 text-base font-normal focus:outline-none md:hover:cursor-pointer md:hover:border-th-fgd-4 ${
                      w.adapter.name === wallet?.adapter.name
                        ? 'border-th-primary text-th-fgd-1 md:hover:border-th-primary'
                        : 'border-th-bkg-4 text-th-fgd-4'
                    }`}
                    onClick={() => {
                      select(w.adapter.name)
                    }}
                    key={w.adapter.name}
                  >
                    <div className="flex items-center">
                      <img
                        src={w.adapter.icon}
                        className="mr-2 h-5 w-5"
                        alt={`${w.adapter.name} icon`}
                      />
                      {w.adapter.name}
                    </div>
                  </button>
                ))}
              </div>
              <Button
                className="mt-10 flex w-44 items-center justify-center"
                onClick={connectWallet}
                size="large"
              >
                {connected && mangoAccountLoading ? (
                  <Loading />
                ) : (
                  <div className="flex items-center justify-center">
                    <WalletIcon className="mr-2 h-5 w-5" />
                    Connect Wallet
                  </div>
                )}
              </Button>
            </div>
          ) : null}
        </Transition>
        <Transition
          className="h-full w-full max-w-md"
          show={showSetupStep === 2 && !mangoAccountLoading}
          enter="transition ease-in duration-300 delay-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition ease-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          {showSetupStep === 2 ? (
            <div>
              <div className="pb-6">
                <h2 className="mb-4 text-5xl lg:text-6xl">
                  Create Your Account
                </h2>
                <p className="text-base">
                  You need a Mango Account to get started.
                </p>
              </div>
              <div className="pb-4">
                <p className="mb-2 text-base text-th-fgd-3">
                  Account Name{' '}
                  <span className="ml-1 text-xs text-th-fgd-4">(Optional)</span>
                </p>
                <Input
                  type="text"
                  name="name"
                  id="name"
                  placeholder="Account"
                  value={accountName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setAccountName(e.target.value)
                  }
                />
              </div>
              <div>
                <InlineNotification type="info" desc={t('insufficient-sol')} />
                <div className="mt-10">
                  <Button
                    className="mb-6 flex w-44 items-center justify-center"
                    disabled={solBalance < MIN_SOL_BALANCE}
                    onClick={handleCreateAccount}
                    size="large"
                  >
                    {loadingAccount ? (
                      <Loading />
                    ) : (
                      <div className="flex items-center justify-center">
                        <PlusCircleIcon className="mr-2 h-5 w-5" />
                        Create Account
                      </div>
                    )}
                  </Button>
                  {solBalance < MIN_SOL_BALANCE ? (
                    <div className="mb-6">
                      <InlineNotification
                        type="error"
                        desc={t('deposit-more-sol')}
                      />
                    </div>
                  ) : null}
                  <LinkButton onClick={onClose}>
                    <span className="default-transition text-th-fgd-4 underline md:hover:text-th-fgd-3 md:hover:no-underline">
                      Skip for now
                    </span>
                  </LinkButton>
                </div>
              </div>
            </div>
          ) : null}
        </Transition>
        <Transition
          className="h-full w-full max-w-md"
          show={showSetupStep === 3}
          enter="transition ease-in duration-300 delay-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition ease-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          {showSetupStep === 3 ? (
            <div className="relative">
              <h2 className="mb-6 text-5xl lg:text-6xl">Fund Your Account</h2>
              <Transition
                show={depositToken.length > 0}
                enter="transition ease-in duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition ease-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="flex justify-between">
                  <Label text="Amount" />
                  <MaxAmountButton
                    className="mb-2"
                    label="Wallet Max"
                    onClick={() =>
                      setDepositAmount(
                        floorToDecimal(
                          tokenMax.amount,
                          tokenMax.decimals
                        ).toFixed()
                      )
                    }
                    value={floorToDecimal(
                      tokenMax.amount,
                      tokenMax.decimals
                    ).toFixed()}
                  />
                </div>
                <div className="mb-10 grid grid-cols-2">
                  <button
                    className="col-span-1 flex items-center rounded-lg rounded-r-none border border-r-0 border-th-bkg-4 bg-transparent px-4 hover:bg-transparent"
                    onClick={() => setDepositToken('')}
                  >
                    <div className="ml-1.5 flex w-full items-center justify-between">
                      <div className="flex items-center">
                        <Image
                          alt=""
                          width="20"
                          height="20"
                          src={`/icons/${depositToken.toLowerCase()}.svg`}
                        />
                        <p className="ml-1.5 text-xl font-bold text-th-fgd-1">
                          {depositToken}
                        </p>
                      </div>
                      <PencilIcon className="ml-2 h-5 w-5 text-th-fgd-3" />
                    </div>
                  </button>
                  <Input
                    className="col-span-1 w-full rounded-lg rounded-l-none border border-th-bkg-4 bg-transparent p-3 text-right text-xl font-bold tracking-wider text-th-fgd-1 focus:outline-none"
                    type="text"
                    name="deposit"
                    id="deposit"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setDepositAmount(e.target.value)
                    }
                  />
                  <div className="col-span-2 mt-2">
                    <ButtonGroup
                      activeValue={sizePercentage}
                      onChange={(p) => handleSizePercentage(p)}
                      values={['10', '25', '50', '75', '100']}
                      unit="%"
                    />
                  </div>
                </div>
                <Button
                  className="mb-6 flex w-44 items-center justify-center"
                  disabled={!depositAmount || !depositToken}
                  onClick={handleDeposit}
                  size="large"
                >
                  {submitDeposit ? (
                    <Loading />
                  ) : (
                    <div className="flex items-center justify-center">
                      <ArrowDownTrayIcon className="mr-2 h-5 w-5" />
                      Deposit
                    </div>
                  )}
                </Button>
                <LinkButton onClick={onClose}>
                  <span className="default-transition text-th-fgd-4 underline md:hover:text-th-fgd-3 md:hover:no-underline">
                    Skip for now
                  </span>
                </LinkButton>
              </Transition>
              <Transition
                show={depositToken.length === 0}
                enter="transition ease-in duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition ease-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div
                  className="thin-scroll absolute top-36 w-full overflow-auto"
                  style={{ height: 'calc(100vh - 380px)' }}
                >
                  <div className="grid auto-cols-fr grid-flow-col px-4 pb-2">
                    <div className="">
                      <p className="text-xs">{t('token')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs">{t('deposit-rate')}</p>
                    </div>
                    <div className="text-right">
                      <p className="whitespace-nowrap text-xs">
                        {t('wallet-balance')}
                      </p>
                    </div>
                  </div>
                  <ActionTokenList
                    banks={banks}
                    onSelect={setDepositToken}
                    showDepositRates
                    sortByKey="walletBalanceValue"
                    valueKey="walletBalance"
                  />
                </div>
              </Transition>
            </div>
          ) : null}
        </Transition>
      </div>
      <div className="col-span-1 hidden h-screen lg:block">
        <ParticlesBackground />
      </div>
    </div>
  )
}

export default UserSetup
