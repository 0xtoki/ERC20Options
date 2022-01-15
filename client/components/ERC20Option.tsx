import { Text, Grid, GridItem } from "@chakra-ui/react"
import { useState, useContext, useEffect } from "react"
import { globalContext } from '../store'
import OptionContract from "../public/ERC20Option.json"
import { AbiItem } from 'web3-utils'
import { useButton, useInput } from '../hooks/ui'

// REF: https://dev.to/jacobedawson/send-react-web3-dapp-transactions-via-metamask-2b8n
export default function Greeter() {
  const { globalState, dispatch } = useContext(globalContext)
  const { account, web3 } = globalState
  const contractAddress = process.env.NEXT_PUBLIC_OPTION_CONTRACT_ADDRESS
  const abiItems: AbiItem[] = web3 && OptionContract.abi as AbiItem[]
  const contract = web3 && contractAddress && new web3.eth.Contract(abiItems, contractAddress)
    
  function mintOptions() {
  }

  async function approveTokenSpend() {
  }

  async function exerciseOptions() {
  }

  async function withdrawCollateral() {
  }

  async function getEpoch() {
  }

  useEffect(() => {
  })

  return (
    <div>
    </div>
  )
}