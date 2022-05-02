// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IMeme721 {
   function mintNFT(string[] memory tokenURIs_, address owner_) external;
}