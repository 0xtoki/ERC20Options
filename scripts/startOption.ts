// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const ONE = ethers.utils.parseUnits("1", 18);
  const TWO = ethers.utils.parseUnits("2", 18);

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const ERC20Option = await ethers.getContractAt("ERC20Option", "0xCcF1fEA05EE5C5954Cb6f083A3c6e9Ff2Cb55eB9");
  const token = await ethers.getContractAt("ERC20Mock", "0x001f97b579fC30dcB636efc137199c622eC72A96");

  //await token.mint(deployer.address, ONE);

  const tokenBalance = await token.balanceOf(ERC20Option.address);
  const tokenB = await token.balanceOf(deployer.address);

  //await ERC20Option.setStrikes([10, 20, 30]);
  //await ERC20Option.startNextEpoch();
  const tokenAddressFirst = await ERC20Option.epochStrikeTokens(1, 10);
  const optionTokenContractFirst = await ethers.getContractAt("VaultToken", tokenAddressFirst);
  const firstTokenName = await optionTokenContractFirst.name();

  console.log("Token balance:", firstTokenName);
  //console.log("Token balance:", tokenBalance);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
