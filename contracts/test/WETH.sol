// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETH is ERC20 {
   uint256 private initalSupply = 10**6 * 1e18;
   constructor(
   ) ERC20('Wrapped ETH', 'WETH') {
      _mint(msg.sender, initalSupply);
   }

}