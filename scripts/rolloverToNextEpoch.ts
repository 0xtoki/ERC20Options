import { ethers } from "hardhat";
import * as time from "../test/helpers/time";
import { Wallet, BigNumber, Contract, utils } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();
  const timeInterval = BigNumber.from("10");

  const ERC20Option = await ethers.getContractAt("ERC20Option", "0x164ce3A917BE4F954b2155057635A5Cd1e1A3f70");
  const token = await ethers.getContractAt("ERC20Mock", "0x12AD50Fb037715DBb61D4336D85fd18d97f40fB2");

  await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
  await ERC20Option.expireEpoch();
  await ERC20Option.setStrikes([12, 22, 33]);
  await ERC20Option.startNextEpoch();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
