import { useCallback, useMemo, useState } from 'react'
import { clusterApiUrl, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { ConnectionProvider, useAnchorWallet, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'

import '@solana/wallet-adapter-react-ui/styles.css'

const SOL_TRANSFER_LAMPORTS = 100000 // 0.0001 SOL

function SolanaActions() {
	const { connection } = useConnection()
	const wallet = useWallet()
	const anchorWallet = useAnchorWallet()
	const [status, setStatus] = useState<string>('')

	const signMessage = useCallback(async () => {
		try {
			if (!wallet.signMessage) throw new Error('当前钱包不支持消息签名')
			const message = new TextEncoder().encode('Hello from dapp-for-test')
			const signature = await wallet.signMessage(message)
			setStatus(`消息签名成功: ${Buffer.from(signature).toString('hex').slice(0, 32)}...`)
		} catch (err: any) {
			setStatus(`消息签名失败: ${err?.message || String(err)}`)
		}
	}, [wallet])

	const signAndSendTransfer = useCallback(async () => {
		try {
			if (!wallet.publicKey) throw new Error('请先连接钱包')
			const payerPublicKey = wallet.publicKey
			const toPublicKey = new PublicKey(payerPublicKey)

			const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

			const ix = SystemProgram.transfer({
				fromPubkey: payerPublicKey,
				toPubkey: toPublicKey,
				lamports: SOL_TRANSFER_LAMPORTS,
			})

			const messageV0 = new TransactionMessage({
				payerKey: payerPublicKey,
				recentBlockhash: blockhash,
				instructions: [ix],
			}).compileToV0Message()

			const tx = new VersionedTransaction(messageV0)

			if (!wallet.signTransaction) throw new Error('当前钱包不支持交易签名')
			await wallet.signTransaction(tx)
			const sig = await connection.sendRawTransaction(tx.serialize())
			await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
			setStatus(`交易已确认: ${sig}`)
		} catch (err: any) {
			setStatus(`交易发送失败: ${err?.message || String(err)}`)
		}
	}, [wallet, connection])

	return (
		<div style={{ padding: 24 }}>
			<div style={{ marginBottom: 12 }}>
				<WalletMultiButton />
			</div>
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
				<button onClick={signMessage} disabled={!wallet.connected}>
					签名消息
				</button>
				<button onClick={signAndSendTransfer} disabled={!wallet.connected}>
					签名并发送 0.0001 SOL 自转账
				</button>
			</div>
			{anchorWallet?.publicKey && (
				<p style={{ marginTop: 12, wordBreak: 'break-all' }}>
					当前地址: {anchorWallet.publicKey.toBase58()}
				</p>
			)}
			{status && (
				<p style={{ marginTop: 12, wordBreak: 'break-all' }}>{status}</p>
			)}
		</div>
	)
}

export default function SolanaTest() {
	// Use mainnet or devnet; here we use devnet to avoid real SOL spending
	const endpoint = useMemo(() => clusterApiUrl('devnet'), [])
	const wallets = useMemo(
		() => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()],
		[],
	)

	return (
		<ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
			<WalletProvider wallets={wallets} autoConnect>
				<WalletModalProvider>
					<SolanaActions />
				</WalletModalProvider>
			</WalletProvider>
		</ConnectionProvider>
	)
}


