"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAccount, useDisconnect, useWalletClient } from "wagmi"
import { usePublicClient } from "wagmi"
import { Loader } from "@/components/loader"
import { PrivyClientConfig, PrivyProvider } from "@privy-io/react-auth"
import { Hash, http } from "viem"
import {
    SmartAccountClient,
    createSmartAccountClient,
} from "permissionless"
import { DemoTransactionButton } from "@/components/demo-transaction"
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { bscTestnet } from "viem/chains"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useSetActiveWallet } from '@privy-io/wagmi'
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { entryPoint06Address, entryPoint07Address } from "viem/account-abstraction"
import { toSimpleSmartAccount } from "permissionless/accounts"

const wagmiConfig = createConfig({
    chains: [bscTestnet],
    transports: {
      [bscTestnet.id]: http(),
    },
  });

if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID)
    throw new Error("Missing NEXT_PUBLIC_PRIVY_APP_ID")

if (!process.env.NEXT_PUBLIC_PIMLICO_API_KEY)
    throw new Error("Missing NEXT_PUBLIC_PIMLICO_API_KEY")

const pimlicoRpcUrl = `https://api.pimlico.io/v2/97/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`

const pimlicoPaymaster = createPimlicoClient({
    transport: http(pimlicoRpcUrl),
    entryPoint: {
        address: entryPoint06Address,
        version: "0.6",
    },
})

const queryClient = new QueryClient();

const privyConfig: PrivyClientConfig = {
    embeddedWallets: {
        createOnLogin: 'users-without-wallets',
        requireUserPasswordOnCreate: false,
    },
    loginMethods: ['email'],
    appearance: {
        showWalletLoginFirst: false,
    },
};

export const PrivyFLowProvider = ({
    children
}: { children: React.ReactNode }) => {
    return (
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
          config={privyConfig}
        >
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
              {children}
            </WagmiProvider>
          </QueryClientProvider>
        </PrivyProvider>
    );
}

export const PrivyFlow = () => {
    const { login, ready, authenticated } = usePrivy()
    const { isConnected } = useAccount()
    const [smartAccountClient, setSmartAccountClient] = useState<SmartAccountClient | null>(null)
    const publicClient = usePublicClient()
    const { wallets } = useWallets()
    const { data: walletClient } = useWalletClient()
    const [txHash, setTxHash] = useState<string | null>(null)
    const [approveTxHash, setApproveTxHash] = useState<string | null>(null)
    const { disconnect } = useDisconnect()
    const [recipientAddress, setRecipientAddress] = useState<string>('')
    const [amount, setAmount] = useState<string>('0.1')

    const embeddedWallet = useMemo(
        () => wallets.find((wallet) => wallet.walletClientType === "privy"),
        [wallets]
    )

    const { setActiveWallet } = useSetActiveWallet()

    useEffect(() => {
        if (embeddedWallet) {
            setActiveWallet(embeddedWallet)
        }
    }, [embeddedWallet, setActiveWallet])

    useEffect(() => {
        const initSmartAccount = async () => {
            if (!isConnected || !walletClient || !publicClient) return

            try {
                const safeSmartAccountClient = await toSimpleSmartAccount({
                    client: publicClient,
                    owner: walletClient,
                    entryPoint: {
                        address: entryPoint06Address,
                        version: "0.6"
                    }
                })

                const smartAccountClient = createSmartAccountClient({
                    account: safeSmartAccountClient,
                    chain: bscTestnet,
                    bundlerTransport: http(pimlicoRpcUrl),
                    paymaster: pimlicoPaymaster,
                    userOperation: {
                        estimateFeesPerGas: async () => (await pimlicoPaymaster.getUserOperationGasPrice()).fast,
                    },
                })

                setSmartAccountClient(smartAccountClient)
            } catch (error) {
                console.error("Failed to initialize smart account:", error)
            }
        }

        initSmartAccount()
    }, [isConnected, walletClient, publicClient])

    const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRecipientAddress(e.target.value)
    }

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value)
    }

    if (!ready) return null

    return (
        <div className="flex flex-col items-center gap-4 p-4">
            {!authenticated && (
                <button
                    onClick={() => login()}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                    Login with Email
                </button>
            )}

            {isConnected && smartAccountClient && (
                <div className="flex flex-col items-center gap-4">
                    <div className="text-sm">
                        Smart Account: {smartAccountClient.account?.address}
                    </div>
                    
                    <div className="flex flex-col gap-4 w-full max-w-md">
                        <input
                            type="text"
                            placeholder="Recipient Address"
                            value={recipientAddress}
                            onChange={handleRecipientChange}
                            className="w-full px-4 py-2 border rounded text-black"
                        />
                        <input
                            type="text"
                            placeholder="Amount (in ETH)"
                            value={amount}
                            onChange={handleAmountChange}
                            className="w-full px-4 py-2 border rounded text-black"
                        />
                        
                        <div className="flex gap-4">
                            <button
                                onClick={() => disconnect()}
                                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Disconnect
                            </button>
                            
                            <DemoTransactionButton
                                smartAccountClient={smartAccountClient}
                                onSendTransaction={setTxHash}
                                onApproveTransaction={setApproveTxHash}
                                recipientAddress={recipientAddress}
                                amount={amount}
                            />
                        </div>
                    </div>

                    {approveTxHash && (
                        <a
                            href={`https://testnet.bscscan.com/tx/${approveTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                        >
                            View Approval Transaction
                        </a>
                    )}

                    {txHash && (
                        <a
                            href={`https://testnet.bscscan.com/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                        >
                            View Send Token Transaction
                        </a>
                    )}
                </div>
            )}
        </div>
    )
}
