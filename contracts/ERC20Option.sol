//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// libraries
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

// interfaces 
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { ERC20PresetMinterPauserUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";


contract ERC20Option is Ownable, Pausable{

    address public immutable collateralAsset;

    /// @dev Current epoch for ssov
    uint256 public currentEpoch;

    /// @dev ERC20PresetMinterPauserUpgradeable implementation address
    address public immutable erc20Implementation;

    /// @notice Is vault ready for next epoch
    /// @dev epoch => whether the vault is ready (boostrapped)
    mapping(uint256 => bool) public isVaultReady;

    /// @notice Is the epoch ready
    /// @dev epoch => whether the epoch is active
    mapping(uint256 => bool) public isEpochActive;

    /// @dev Mapping of strikes for each epoch
    mapping(uint256 => uint256[]) public epochStrikes;

    /// @notice Is epoch expired
    /// @dev epoch => whether the epoch is expired
    mapping(uint256 => bool) public isEpochExpired;

    /// @dev Mapping of (epoch => (strike => tokens))
    mapping(uint256 => mapping(uint256 => address)) public epochStrikeTokens;

    /// @dev epoch => the epoch start time
    mapping(uint256 => uint256) public epochStartTimes;

    /// @notice Epoch deposits by user for each strike
    /// @dev mapping (epoch => (abi.encodePacked(user, strike) => user deposits))
    mapping(uint256 => mapping(bytes32 => uint256)) public userEpochDeposits;

    /// @notice Total epoch deposits for specific strikes
    /// @dev mapping (epoch => (strike => deposits))
    mapping(uint256 => mapping(uint256 => uint256))
    public totalEpochStrikeDeposits;

    /// @notice Total epoch deposits across all strikes
    /// @dev mapping (epoch => deposits)
    mapping(uint256 => uint256) public totalEpochDeposits;

    /// @notice Total epoch deposits for specific strikes including premiums and rewards
    /// @dev mapping (epoch => (strike => deposits))
    mapping(uint256 => mapping(uint256 => uint256))
    public totalEpochStrikeBalance;

    /// @notice Total epoch deposits across all strikes including premiums and rewards
    /// @dev mapping (epoch => deposits)
    mapping(uint256 => uint256) public totalEpochBalance;

    /*==== EVENTS ====*/

    event NewDeposit(
        uint256 epoch,
        uint256 strike,
        uint256 amount,
        address user,
        address sender
    );

    event NewStrike(
        uint256 epoch,
        uint256[] strikes
    );

    event epochStarted(
        uint256 epoch
    );


    /**
     * @notice initiates the next epoch
     * @return Whether bootstrap was successful
     */
    function nextEpoch() external onlyOwner whenNotPaused returns (bool) {
        uint256 nextEpoch = currentEpoch + 1;
        require(!isVaultReady[nextEpoch], "E");
        require(epochStrikes[nextEpoch].length > 0, "E");

        if (currentEpoch > 0) {
            // Previous epoch must be expired
            require(isEpochExpired[currentEpoch], "E");
        }

        for (uint256 i = 0; i < epochStrikes[nextEpoch].length; i++) {
            uint256 strike = epochStrikes[nextEpoch][i];
            string memory name = concatenate("DPX-CALL", strike.toString());
            name = concatenate(name, "-EPOCH-");
            name = concatenate(name, (nextEpoch).toString());
            // Create doTokens representing calls for selected strike in epoch
            ERC20PresetMinterPauserUpgradeable _erc20 = ERC20PresetMinterPauserUpgradeable(
                    Clones.clone(erc20Implementation)
                );
            _erc20.initialize(name, name);
            epochStrikeTokens[nextEpoch][strike] = address(_erc20);
        }

        // Mark vault as ready for epoch
        isVaultReady[nextEpoch] = true;
        // Increase the current epoch
        currentEpoch = nextEpoch;

        emit epochStarted(nextEpoch);

        return true;
    }

    /**
     * @notice Sets strikes for next epoch
     * @param strikes Strikes to set for next epoch
     * @return Whether strikes were set
     */
    function setStrikes(uint256[] memory strikes)
        external
        onlyOwner
        whenNotPaused
        returns (bool)
    {
        uint256 nextEpoch = currentEpoch + 1;

        if (currentEpoch > 0) {
            //(, uint256 epochExpiry) = getEpochTimes(currentEpoch);
            // epochExpiry is a month out from previous epoch
            require((block.timestamp > epochExpiry), "E");
        }

        // Set the next epoch strikes
        epochStrikes[nextEpoch] = strikes;
        // Set the next epoch start time
        epochStartTimes[nextEpoch] = block.timestamp;

        for (uint256 i = 0; i < strikes.length; i++)
            emit NewStrike(nextEpoch, strikes[i]);
        return true;
    }

        /**
     * @notice Deposits dpx into the ssov to mint options in the next epoch for selected strikes
     * @param strikeIndex Index of strike
     * @param amount Amout of DPX to deposit
     * @param user Address of the user to deposit for
     * @return Whether deposit was successful
     */
    function mintOption(
        uint256 strikeIndex,
        uint256 amount,
        address user
    ) public whenNotPaused returns (bool) {

        if (currentEpoch > 0) {
            require(
                isEpochActive[currentEpoch],
                "E"
            );
        }

        // Must be a valid strikeIndex
        require(strikeIndex < epochStrikes[currentEpoch].length, "E");

        // Must +ve amount
        require(amount > 0, "E");

        // Must be a valid strike
        uint256 strike = epochStrikes[currentEpoch][strikeIndex];
        require(strike != 0, "E");

        bytes32 userStrike = keccak256(abi.encodePacked(user, strike));

        abi.
        // Transfer DPX from msg.sender (maybe different from user param) to ssov
        IERC20(collateralAsset).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Add to user epoch deposits
        userEpochDeposits[currentEpoch][userStrike] += amount;
        // Add to total epoch strike deposits
        totalEpochStrikeDeposits[currentEpoch][strike] += amount;
        // Add to total epoch deposits
        totalEpochDeposits[currentEpoch] += amount;
        // Add to total epoch strike deposits
        totalEpochStrikeBalance[currentEpoch][strike] += amount;
        // Add to total epoch deposits
        totalEpochBalance[currentEpoch] += amount;

        emit NewDeposit(currentEpoch, strike, amount, user, msg.sender);

        return true;
    }

    /**
     * @notice Returns a concatenated string of a and b
     * @param a string a
     * @param b string b
     */
    function concatenate(string memory a, string memory b)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(a, b));
    }
}