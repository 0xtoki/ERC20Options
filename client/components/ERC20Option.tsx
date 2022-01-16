import { Text, Grid, GridItem } from "@chakra-ui/react";
import { useState, useContext, useEffect } from "react";
import { globalContext } from "../store";
import OptionContract from "../public/ERC20Option.json";
import VaultToken from "../public/ERC20Mock.json";
import { AbiItem } from "web3-utils";
import { useButton, useInput } from "../hooks/ui";
import { setUncaughtExceptionCaptureCallback } from "process";
import { Notify } from "notiflix/build/notiflix-notify-aio";

// REF: https://dev.to/jacobedawson/send-react-web3-dapp-transactions-via-metamask-2b8n
export default function ERC20Option() {
  const { globalState, dispatch } = useContext(globalContext);
  const { account, web3 } = globalState;
  const [greetingOutput, setGreetingOutput] = useState("");
  const [currentEpoch, setCurrentEpoch] = useState(null);
  const [tstBalance, setCurrentTSTBalance] = useState(0);
  const [epochExpiry, setEpochExpiry] = useState(NaN);
  const [epochStrikes, setEpochStrikes] = useState([""]);
  const [epochOptionTokens, setEpochOptionTokens] = useState([""]);

  const contractAddress = process.env.NEXT_PUBLIC_OPTION_CONTRACT_ADDRESS;
  const tokenContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
  const optionAbi: AbiItem[] = web3 && (OptionContract.abi as AbiItem[]);
  const optionContract = web3 && contractAddress && new web3.eth.Contract(optionAbi, contractAddress);
  const tokenAbi: AbiItem[] = web3 && (VaultToken.abi as AbiItem[]);
  const tokenContract = web3 && contractAddress && new web3.eth.Contract(tokenAbi, tokenContractAddress);

  const [mintOptionLoading, mintButton] = useButton(mintOptions, "Mint Options");
  const [exerciseOptionLoading, exerciseButton] = useButton(exerciseOption, "Exercise Options");
  const [withdrawLoading, withdrawButton] = useButton(withdrawCollateral, "Withdraw Collateral");
  const [tokenAmount, tokenAmountInput] = useInput(mintOptionLoading as boolean, "option amount");
  const [strikePriceMint, strikePriceMintInput] = useInput(mintOptionLoading as boolean, "strike price");

  const [withdrawEpoch, withdrawEpochInput] = useInput(withdrawLoading as boolean, "withdraw epoch");
  const [withdrawStrike, withdrawStrikeInput] = useInput(withdrawLoading as boolean, "withdraw strike price");

  async function getOptionState() {
    if (optionContract && tokenContract) {
      await optionContract.methods
        .currentEpoch()
        .call()
        .then((result: any) => {
          setCurrentEpoch(result);
        });
      optionContract.methods
        .epochExpiry()
        .call()
        .then((result: any) => {
          setEpochExpiry(result);
        });
      if (currentEpoch) {
        optionContract.methods
          .getEpochStrikes(currentEpoch)
          .call()
          .then((result: any) => {
            console.log(result);
            setEpochStrikes(result);
          });
      }
      let address = web3.currentProvider.selectedAddress;
      tokenContract.methods
        .balanceOf(address)
        .call()
        .then((result: any) => {
          setCurrentTSTBalance(result);
        });
    }
  }
  async function mintOptions() {
    let strikeIndex = await indexFromPriceEpoch(strikePriceMint, currentEpoch);

    if (strikeIndex == -1) {
      Notify.failure("Strike price invalid for that epoch");
      return;
    }
    await approveTokenSpend().then(() => {
      if (optionContract) {
        let address = web3.currentProvider.selectedAddress;
        optionContract.methods
          .mintOption(strikeIndex, tokenAmount, address)
          .send({ from: address })
          .then((result: any) => {
            setGreetingOutput(result);
            console.log(result);
          });
      }
    });
    await getOptionState();
  }

  async function approveTokenSpend() {
    if (tokenContract && tokenAmount) {
      let address = web3.currentProvider.selectedAddress;
      tokenContract.methods
        .approve(contractAddress, tokenAmount)
        .send({ from: address })
        .then((result: any) => {
          console.log(result);
        });
    }
  }
  async function approvedTokenSpend() {
    if (tokenContract) {
      console.log(11);
      let address = web3.currentProvider.selectedAddress;
      tokenContract.methods
        .allowance(address, contractAddress)
        .call()
        .then((result: any) => {
          console.log(result);
        });
    }
  }

  async function getOptionContractTokens() {
    if (currentEpoch && epochStrikes[0] != "") {
      let optionTokenAddress = [];
      for (let strike = 0; strike < epochStrikes.length; strike++) {
        await optionContract.methods
          .epochStrikeTokens(currentEpoch, epochStrikes[strike])
          .call()
          .then((result: any) => {
            optionTokenAddress.push(result);
          });
      }
      setEpochOptionTokens(optionTokenAddress);
      return optionTokenAddress;
    }
  }

  async function withdrawCollateral() {}

  async function exerciseOption() {}

  function toDate() {
    if (epochExpiry) {
      let date = new Date(epochExpiry * 1000);
      return date.toISOString();
    }
    return "";
  }

  async function indexFromPriceEpoch(price: { toString: () => any }, epoch: number) {
    if (currentEpoch) {
      if (0 < epoch && epoch <= currentEpoch) {
        let strikes = await optionContract.methods
          .getEpochStrikes(currentEpoch)
          .call()
          .then((result: any) => {
            return result;
          });
        return strikes.indexOf(price.toString());
      }
      return -1;
    }
  }

  useEffect(() => {
    if (epochStrikes[0] == "" || epochOptionTokens[0] == "") {
      getOptionState();
      getOptionContractTokens();
    }
  });

  return (
    <div>
      {
        <div>
          <Grid mt="5" templateColumns="repeat(4, 1fr)" templateRows="repeat(4, 1fr)" gap={3}>
            <GridItem>
              <Text textAlign="center" fontWeight="bold">
                Current Epoch
              </Text>
            </GridItem>
            <GridItem>
              <Text textAlign="center" fontWeight="bold">
                Epoch Expiry
              </Text>
            </GridItem>
            <GridItem>
              <Text textAlign="center" fontWeight="bold">
                Epoch Strikes
              </Text>
            </GridItem>
            <GridItem>
              <Text textAlign="center" fontWeight="bold">
                TST Balance
              </Text>
            </GridItem>
            <GridItem>
              <Text textAlign="center" fontWeight="bold">
                {currentEpoch}
              </Text>
            </GridItem>
            <GridItem>
              <Text textAlign="center" fontWeight="bold">
                {toDate()}
              </Text>
            </GridItem>
            <GridItem>
              <Text textAlign="center" fontWeight="bold">
                {epochStrikes.map(function (strike) {
                  return `$${strike} `;
                })}
              </Text>
            </GridItem>
            <GridItem>
              <Text textAlign="center" fontWeight="bold">
                {tstBalance / 10 ** 18}
              </Text>
            </GridItem>
          </Grid>
          <br />
          <Grid mt="5" templateColumns="repeat(3, 1fr)" templateRows="repeat(4, 1fr)" gap={3}>
            <GridItem align="left">{mintButton} </GridItem>
            <GridItem align="end">{exerciseButton}</GridItem>
            <GridItem align="end">{withdrawButton}</GridItem>
            <GridItem align="end">{tokenAmountInput}</GridItem>
            <GridItem colSpan={1}></GridItem>
            <GridItem align="end">{withdrawEpochInput}</GridItem>
            <GridItem align="end">{strikePriceMintInput}</GridItem>
            <GridItem colSpan={1}></GridItem>
            <GridItem align="end">{withdrawStrikeInput}</GridItem>
          </Grid>
          <Grid mt="5" templateColumns="repeat(1, 1fr)" templateRows="repeat(4, 1fr)" gap={3}>
            <GridItem align="end " colSpan={1}>
              <Text textAlign="center" fontWeight="bold">
                Options token contracts
              </Text>
            </GridItem>
            {epochOptionTokens.map(function (strike) {
              return (
                <GridItem key={strike}>
                  <Text textAlign="center" fontWeight="bold">
                    {strike}
                  </Text>
                </GridItem>
              );
            })}
          </Grid>
        </div>
      }
    </div>
  );
}
