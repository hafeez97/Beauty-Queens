import Head from 'next/head'
import Mint from "../pages/mint"
import { config } from '../dapp.config'
export default function Home() {
  return (
    <div className="min-h-screen h-full w-full flex flex-col bg-brand-light overflow-hidden">
      <Head>
        <title>{config.title}</title>
        <meta name="description" content={config.description} />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Mint/>
    </div>
  )
}
