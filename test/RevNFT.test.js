const { expect } = require('chai');
const { ethers } = require('hardhat');

const e18 = 1 + '0'.repeat(18)
const e26 = 1 + '0'.repeat(26)
const e24 = 1 + '0'.repeat(24)

const bigNum = num=>(num + '0'.repeat(18))
const smallNum = num=>(parseInt(num)/bigNum(1))
const tokenURIs = [
   'https://gateway.pinata.cloud/ipfs/QmfUk1XLTrgQmbjwGw7sKa1DggNeZoYtk5JD4n4bq1eRHk',
   'https://gateway.pinata.cloud/ipfs/QmRGyvR1PBhjBXmkMxrtHHfYH7uoctT7XAqkc1GiA52sBe',
   'https://gateway.pinata.cloud/ipfs/QmUgUiJNAPiH9sUhhkjrJxRcwhjchVsbzNdu5umrJgAEhk',
   'https://gateway.pinata.cloud/ipfs/QmTnH7cmFiQdWWpUnKMdUqEWZNVESrqbKUu8f496CCqe22',
   'https://gateway.pinata.cloud/ipfs/QmXXaQj5TTocKDdnDbYguUS4BiQDqrtKjHVPUdcYtUMmpU',
   'https://gateway.pinata.cloud/ipfs/QmPzY59ajxEEwVwMakqj7zkLMAMCEu4vUEvQATCuZ1CeLB'
]

describe('RevNFT', function () {
   before (async function () {
      [
         this.owner,
         this.dev,
         this.addr1,
         this.addr2
      ] = await ethers.getSigners();

      this.revNFT = await ethers.getContractFactory('RevNFT');
      this.revNFT = await this.revNFT.deploy(
         'RevNFT', 
         'REV', 
         bigNum(2)
      );
      await this.revNFT.deployed();
   })

   it ('Check basic features of Rev token.', async function () {
      const supply = await this.revNFT.totalSupply();
      expect(supply).to.equal(0);
      const name = await this.revNFT.name();
      expect(name).to.equal('RevNFT');
      const symbol = await this.revNFT.symbol();
      expect(symbol).to.equal('REV');
   })

   it ('Mint 2 NFTs.', async function () {
      await this.revNFT.createNFT([ tokenURIs[0],tokenURIs[1] ], {value: bigNum(4)});

      const supply = await this.revNFT.totalSupply();
      expect(supply).to.equal(2);

      expect(await this.revNFT.tokenURI(0)).to.be.equal(tokenURIs[0]);
      expect(await this.revNFT.tokenURI(1)).to.be.equal(tokenURIs[1]);
   })

   it ('Withdraw funds.', async function () {
      let oldBalance = await ethers.provider.getBalance(this.owner.address);
      oldBalance = Math.floor(smallNum(oldBalance));

      await this.revNFT.withdrawFund();

      let newBalance = await ethers.provider.getBalance(this.owner.address);
      newBalance = Math.floor(smallNum(newBalance));

      expect(newBalance - oldBalance).to.equal(4);
   })
})