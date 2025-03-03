import { PrivyFLowProvider, PrivyFlow } from "@/components/privy"

export const Home = () => {
    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
            <PrivyFLowProvider>
                <PrivyFlow />
            </PrivyFLowProvider>
        </main>
    )
}
