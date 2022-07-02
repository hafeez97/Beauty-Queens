import { useState, useEffect } from 'react'
import { initOnboard } from '../utils/onboard'
import { useConnectWallet, useSetChain, useWallets } from '@web3-onboard/react'
import { config } from '../dapp.config'
const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const whitelist = require('../scripts/whitelist')
import { createAlchemyWeb3 } from '@alch/alchemy-web3'


import {
  getTotalMinted,
  getMaxSupply,
  isPausedState,
  isPublicSaleState,
  isPreSaleState,
  getPrice,
} from '../utils/interact'


export default function Mint() {
  const web3 = createAlchemyWeb3(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL)
  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()
  const [{ chains, connectedChain, settingChain }, setChain] = useSetChain()
  const connectedWallets = useWallets()
  const [maxSupply, setMaxSupply] = useState(0)
  const [totalMinted, setTotalMinted] = useState(0)
  const [maxMintAmount, setMaxMintAmount] = useState(0)
  const [paused, setPaused] = useState(false)
  const [isPublicSale, setIsPublicSale] = useState(false)
  const [isPreSale, setIsPreSale] = useState(false)
  const [status, setStatus] = useState(null)
  const [mintAmount, setMintAmount] = useState(1)
  const [isMinting, setIsMinting] = useState(false)
  const [onboard, setOnboard] = useState(null)
  const [price, setPrice] = useState(0)
  const convert = require('ethereum-unit-converter')


//Minting functionality
  const contract = require('../artifacts/contracts/BeautyQueensNFT.sol/TestBeautyQueensNFT.json')
  const nftContract = new web3.eth.Contract(contract.abi, config.contractAddress)
  // Calculate merkle root from the whitelist array
  const leafNodes = whitelist.map((addr) => keccak256(addr))
  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
  const root = merkleTree.getRoot()

  const presaleMint = async (mintAmount) => {
    if (!window.ethereum.selectedAddress) {
      return {
        success: false,
        status: 'To be able to mint, you need to connect your wallet'
      }
    }

    const leaf = keccak256(window.ethereum.selectedAddress)
    const proof = merkleTree.getHexProof(leaf)

    // Verify Merkle Proof
    const isValid = merkleTree.verify(proof, leaf, root)

    if (!isValid) {
      return {
        success: false,
        status: 'You are not on the whitelist!'
      }
    }

    const nonce = await web3.eth.getTransactionCount(
      window.ethereum.selectedAddress,
      'latest'
    )

    // Set up our Ethereum transaction presale
    const tx = {
      to: config.contractAddress,
      from: window.ethereum.selectedAddress,
      value: parseInt(
        web3.utils.toWei(String(price * mintAmount), 'ether')
      ).toString(16), // hex

      data: nftContract.methods
        .presaleMint(window.ethereum.selectedAddress, mintAmount, proof)
        .encodeABI(),
      nonce: nonce.toString(16)
    }

    try {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx]
      })

      return {
        success: true,
        status: (
          <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
            <p>✅ Check out your transaction on Etherscan:</p>
            <p>{`https://etherscan.io/tx/${txHash}`}</p>
          </a>
        )
      }
    } catch (error) {
      return {
        success: false,
        status: '😞 Smth went wrong:' + error.message
      }
    }
  }
  const publicMint = async (mintAmount) => {
    if (!window.ethereum.selectedAddress) {
      return {
        success: false,
        status: 'To be able to mint, you need to connect your wallet'
      }
    }

    const nonce = await web3.eth.getTransactionCount(
      window.ethereum.selectedAddress,
      'latest'
    )
    // Set up our Ethereum transaction publicsale
    const tx = {
      to: config.contractAddress,
      from: window.ethereum.selectedAddress,
      value: parseInt(
        web3.utils.toWei(String(price * mintAmount), 'ether')
      ).toString(16), // hex
      data: nftContract.methods.publicSaleMint(mintAmount).encodeABI(),
      nonce: nonce.toString(16)
    }

    try {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx]
      })

      return {
        success: true,
        status: (
          <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
            <p>✅ Check out your transaction on Etherscan:</p>
            <p>{`https://etherscan.io/tx/${txHash}`}</p>
          </a>
        )
      }
    } catch (error) {
      return {
        success: false,
        status: '😞 Smth went wrong:' + error.message
      }
    }
  }
  //mint stuff copied end

  useEffect(() => {
    setOnboard(initOnboard)
  }, [])


  useEffect(() => {
    if (!connectedWallets.length) return

    const connectedWalletsLabelArray = connectedWallets.map(
      ({ label }) => label
    )
    window.localStorage.setItem(
      'connectedWallets',
      JSON.stringify(connectedWalletsLabelArray)
    )
  }, [connectedWallets])

  useEffect(() => {
    if (!onboard) return
    const previouslyConnectedWallets = JSON.parse(
      window.localStorage.getItem('connectedWallets')
    )

    if (previouslyConnectedWallets?.length) {
      async function setWalletFromLocalStorage() {
        await connect({
          autoSelect: {
            label: previouslyConnectedWallets[0],
            disableModals: true
          }
        })
      }
      setWalletFromLocalStorage()
    }
  }, [onboard, connect])

  useEffect(() => {
    const onit = async () => {
      const rawPrice = await getPrice()
      const result = convert(rawPrice, 'wei')
      setPrice(result.ether)
    }
    onit()
  }, [])


  useEffect(() => {
    const init = async () => {
      setMaxSupply(await getMaxSupply())
      setTotalMinted(await getTotalMinted())
      setPaused(await isPausedState())
      setIsPublicSale(await isPublicSaleState())
      const isPreSale = await isPreSaleState()
      setIsPreSale(isPreSale)
      setMaxMintAmount(
        isPreSale ? config.presaleMaxMintAmount : config.maxMintAmount
      )
    }
    init()
  }, [])

  const incrementMintAmount = () => {
    if (mintAmount < maxMintAmount) {
      setMintAmount(mintAmount + 1)
    }
  }

  const decrementMintAmount = () => {
    if (mintAmount > 1) {
      setMintAmount(mintAmount - 1)
    }
  }

  const presaleMintHandler = async () => {
    setIsMinting(true)
    const { success, status } = await presaleMint(mintAmount)

    setStatus({
      success,
      message: status
    })

    setIsMinting(false)
  }
  const publicMintHandler = async () => {
    setIsMinting(true)

    const { success, status } = await publicMint(mintAmount)
    setStatus({
      success,
      message: status
    })
    setIsMinting(false)
  }

  return (
    <>

      <div className="min-h-screen h-full w-full overflow-hidden flex flex-col items-center justify-center bg-brand-background font-monospace tracking-wide ">

        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <img
            src="/images/purplebg.jpg"
            className="animate-pulse-slow absolute inset-auto block w-full min-h-screen object-cover"
            alt=""/>

          <div className="flex flex-col items-center justify-center h-full w-full px-2 md:px-10">
            <div className="relative z-1 md:max-w-3xl w-full  filter backdrop-blur-sm py-4 rounded-md px-2 md:px-10 flex flex-col items-center bgColorGradiant">
              <h1 className="mobileHeading text-7xl uppercase font-bold md:text-4xl bg-gradient-to-br  from-[#FFD700] to-white bg-clip-text text-transparent mt-3">
                {paused ? 'Paused' : isPreSale ? 'Pre-Sale' : 'Public Sale'}
              </h1>
              <h3 className="text-sm text-pink-200 tracking-widest">
                {wallet?.accounts[0]?.address
                  ? wallet?.accounts[0]?.address.slice(0, 8) +
                  '...' +
                  wallet?.accounts[0]?.address.slice(-4)
                  : ''}
              </h3>

              <div className="flex flex-col md:flex-row md:space-x-14 w-full mt-10 md:mt-14">
                <div className="relative w-full">
                  <div className="z-10 absolute top-2 left-2 opacity-80 filter backdrop-blur-lg text-base px-4 py-2 bg-black border border-brand-white rounded-md flex items-center justify-center text-white font-semibold">
                    <p>
                      <span className="text-[#ff6900]">{totalMinted}</span> /{' '}
                      {maxSupply}
                    </p>
                  </div>

                  <img
                    src="/images/cartgif.gif"
                    className="mobileImg mx-auto object-cover w-full sm:h-[280px] md:w-[250px]  rounded-md"
                    alt=""/>
                </div>

                <div className="flex flex-col items-center w-full px-4 mt-16 md:mt-0">
                  <div className="font-coiny flex items-center justify-between w-full">
                    <button
                      className="w-14 h-10 md:w-16 md:h-12 flex items-center justify-center text-brand-background hover:shadow-lg bg-gray-300 font-bold rounded-md bg-white"
                      onClick={incrementMintAmount}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 md:h-8 md:w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </button>

                    <p className="flex items-center justify-center flex-1 grow text-center font-bold text-[#FFD700] text-3xl md:text-4xl">
                      {mintAmount}
                    </p>

                    <button
                      className="w-14 h-10 md:w-16 md:h-12 flex items-center justify-center text-brand-background hover:shadow-lg bg-gray-300 font-bold rounded-md bg-white"
                      onClick={decrementMintAmount}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 md:h-8 md:w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18 12H6"
                        />
                      </svg>
                    </button>
                  </div>

                  <p className="text-sm text-pink-200 tracking-widest mt-3">
                    Max Mint Amount: {maxMintAmount}
                  </p>

                  <div className=" border-t border-b py-4 mt-16 w-full">
                    <div className="w-full text-xl font-semibold flex items-center justify-between text-brand-yellow">
                      <p>Total</p>

                      <div className="flex items-center space-x-3 font-semibold">
                        <p>
                          {Number.parseFloat(price * mintAmount).toFixed(
                            2
                          )}
                          {' '}
                          ETH
                        </p>{' '}
                        <span className="text-gray-300">+ GAS</span>
                      </div>
                    </div>
                  </div>

                  {/* Mint Button && Connect Wallet Button */}
                  {wallet ? (
                    <button
                      className={` ${
                        paused || isMinting
                          ? 'bg-gray-900 cursor-not-allowed'
                          : 'bg-gradient-to-br from-[#B98BC6] to-[#fa82c8] shadow-lg hover:shadow-[#faedf0] hover:transition hover:ease-out hover:delay-75 font-bold'
                      } font-monospace mt-12 w-full px-6 py-3 rounded-3xl text-2xl  text-white  mx-4 tracking-wide uppercase font-bold`}
                      disabled={paused || isMinting}
                      onClick={isPreSale ? presaleMintHandler : publicMintHandler}
                    >
                      {isMinting ? 'Minting...' : 'Mint'}
                    </button>
                  ) : (
                    <button
                      className="mt-12 w-full bg-gradient-to-br from-[#B98BC6] to-[#fa82c8] shadow-lg hover:shadow-[#faedf0] hover:transition hover:ease-out hover:delay-75 font-bold  font-bold px-6 py-3 rounded-3xl text-2xl text-white hover:shadow-[#fada91] mx-4 tracking-wide uppercase"
                      onClick={() => connect()}
                    >
                      Connect Wallet
                    </button>
                  )}
                </div>
              </div>

              {/* Status */}
              {status && (
                <div
                  className={`border ${
                    status.success ? 'border-green-500' : 'border-brand-pink-400 '
                  } rounded-md text-start h-full px-4 py-4 w-full mx-auto mt-8 md:mt-4"`}
                >
                  <p className="flex flex-col space-y-2 text-white text-sm md:text-base break-words ...">
                    {status.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </>
  )
}

