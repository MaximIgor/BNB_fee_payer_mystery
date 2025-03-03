import { Loader } from "@/components/loader"
import { SmartAccountClient } from "permissionless"
import { useState } from "react"
import { Hash, encodeFunctionData, parseEther, createPublicClient, http } from "viem"
import { bscTestnet } from "viem/chains"

// Simplified ABIs
const escrowABI = [{
    name: 'sendToken',
    type: 'function',
    inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
} as const]

const tokenABI = [{
    name: 'approve',
    type: 'function',
    inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable'
} as const]

export const DemoTransactionButton = ({
    smartAccountClient,
    onSendTransaction,
    onApproveTransaction,
    recipientAddress,
    amount
}: {
    smartAccountClient: SmartAccountClient
    onSendTransaction: (txHash: Hash) => void
    onApproveTransaction: (txHash: Hash) => void
    recipientAddress: string
    amount: string // Amount in ETH
}) => {
    const [loading, setLoading] = useState<boolean>(false)
    const publicClient = createPublicClient({
        chain: bscTestnet,
        transport: http()
    })

    const sendTransaction = async () => {
        setLoading(true)

        try {
            if (smartAccountClient.account) {
                const escrowContractAddress = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS as `0x${string}`
                const tokenContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}`
                
                if (!escrowContractAddress || !tokenContractAddress) {
                    throw new Error('Contract addresses not properly configured')
                }

                const parsedAmount = parseEther(amount)

                // First, approve the escrow contract to spend tokens
                const approveData = encodeFunctionData({
                    abi: tokenABI,
                    functionName: 'approve',
                    args: [escrowContractAddress, parsedAmount]
                })

                console.log('approveData', approveData)

                const approveTxHash = await smartAccountClient.sendTransaction({
                    account: smartAccountClient.account,
                    chain: bscTestnet,
                    to: tokenContractAddress,
                    data: approveData,
                    value: BigInt(0)
                })

                console.log('Approval transaction hash:', approveTxHash)

                // Wait for approval to be mined
                await publicClient.waitForTransactionReceipt({ hash: approveTxHash })

                onApproveTransaction(approveTxHash)

                // Now send tokens to escrow
                const sendTokenData = encodeFunctionData({
                    abi: escrowABI,
                    functionName: 'sendToken',
                    args: [recipientAddress as `0x${string}`, parsedAmount]
                })
                
                console.log('sendTokenData', sendTokenData)

                const txHash = await smartAccountClient.sendTransaction({
                    account: smartAccountClient.account,
                    chain: bscTestnet,
                    to: escrowContractAddress,
                    data: sendTokenData,
                    value: BigInt(0)
                })

                console.log('SendToken transaction hash:', txHash)
                onSendTransaction(txHash)
            }
        } catch (error) {
            console.error('Transaction failed:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <button
                onClick={sendTransaction}
                className="mt-6 flex justify-center items-center w-64 cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                disabled={loading}
            >
                {!loading && <p className="mr-4">Send Token to Escrow</p>}
                {loading && <Loader />}
            </button>
        </div>
    )
}
