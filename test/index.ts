import { expect } from "chai";
import { ethers } from "hardhat";
import { Wallet, BigNumber, Contract, utils } from "ethers";
import {deployContract, MockProvider, solidity} from 'ethereum-waffle';
import ERC20Option from '../build/ERC20Option.json';

describe("unit:ERC20Option", function () {
  let ERC20Option: Contract;
  const [wallet] = new MockProvider().getWallets();

  describe("deopsits and minting", function () {

    it("should handle collateral deposits", async function () {
    });
    it("should mint tokens and sent to user", async function () {
    });
  });

  describe("Exercise options", function () {
    it("should allow users to exercise options only in the exercise window", async function () {
    });
    it("should send the profit to the user", async function () {
    });
    it("should not send any tokens when the user has a negative PnL", async function () {
    });
    it("should trigger and event when a valid claim is made", async function () {
    });
  });

  describe("Claiming collateral", function () {
    it("should allow depositors to claim remaining collateral after the epoch", async function () {
    });
    it("should not allow depositors to claim before the epoch has ended", async function () {
    });
    it("should return an accurate amount given the options expired in the money", async function () {
    });
    it("should return the full amount given the options expire worthless", async function () {
    });
    it("should trigger an event when the collateral is claimed", async function () {
    });
  });
});
