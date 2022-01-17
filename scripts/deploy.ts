import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const TEN = ethers.utils.parseUnits("10", 18);

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Token = await ethers.getContractFactory("ERC20Mock");
  const token = await Token.deploy("test_token", "TST");

  const ERC20Option = await ethers.getContractFactory("ERC20Option");
  const option = await ERC20Option.deploy(token.address);
  await token.mint(deployer.address, TEN);

  console.log("Option address:", option.address);
  console.log("Token address:", token.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
