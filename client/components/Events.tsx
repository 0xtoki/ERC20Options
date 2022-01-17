import { useState, useContext, useEffect } from "react";
import { globalContext } from "../store";
import OptionContract from "../public/ERC20Option.json";
import { AbiItem } from "web3-utils";
import { Notify } from "notiflix/build/notiflix-notify-aio";

export default function Events() {
  const { globalState, dispatch } = useContext(globalContext);
  const { account, web3 } = globalState;
  const contractAddress = process.env.NEXT_PUBLIC_OPTION_CONTRACT_ADDRESS;
  const optionAbi: AbiItem[] = web3 && (OptionContract.abi as AbiItem[]);
  const optionContract = web3 && contractAddress && new web3.eth.Contract(optionAbi, contractAddress);
  const [contractListener, setContractListener] = useState(null);

  useEffect(() => {
    if (web3 && !contractListener) {
      optionContract.events.allEvents(function (error, event) {
        console.log(event.event);
        Notify.info(`Event: ${event.event}`);
        setContractListener(event);
      });
      console.log("notset");
    }
  });
  return <div />;
}
