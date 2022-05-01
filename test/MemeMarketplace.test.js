const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deploy, deployProxy, getAt } = require('../scripts/utils');
const { signMakeOrder } = require("./utils/meta_transaction");

const bigNum = num=>(num + '0'.repeat(18))
const smallNum = num=>(parseInt(num)/bigNum(1))
const zeroAddress = '0x0000000000000000000000000000000000000000';

const tokenURI = 'https://gateway.pinata.cloud/ipfs/QmfUk1XLTrgQmbjwGw7sKa1DggNeZoYtk5JD4n4bq1eRHk';

describe('MemeMarketplace', function () {
   before (async function () {
      [
         this.deployer,
         this.minter1,
         this.minter2,
         this.bider1,
         this.bider2,
         this.multisig
      ] = await ethers.getSigners();

      this.currencyManager = await deployProxy('MemeCurrencyManager');
      this.strategyManager = await deployProxy('MemeStrategyManager');
      this.ERC721Manager = await deploy('TransferManagerERC721');
      this.ERC1155Manager = await deploy('TransferManagerERC1155');
      this.WETH = await deploy('WETH');
      this.Meme721 = await deploy('Meme721', 'Meme 721', 'Meme721', BigInt(10 ** 15));

      this.marketplace = await deploy(
         'MemeMarketplace',
         this.currencyManager.address,
         this.strategyManager.address,
         this.ERC721Manager.address,
         this.ERC1155Manager.address,
         this.WETH.address,
         this.multisig.address
      );

      await this.ERC721Manager.setMarketPlace(this.marketplace.address);
      await this.ERC1155Manager.setMarketPlace(this.marketplace.address);
      await this.currencyManager.addOwner(this.marketplace.address);
      await this.strategyManager.addOwner(this.marketplace.address);
   })

   it ('check initial state', async function () {
      expect(smallNum(await this.WETH.balanceOf(this.deployer.address))).to.equal(10**6);
   })

   it ('mint Meme721 and add collection to marketplace', async function () {
      await this.Meme721.mintNFT(
         [tokenURI],
         this.minter1.address
      );

      await this.marketplace.addCollection(this.Meme721.address);
   })

   it ('buy NFT', async function () {

      const makeOrder = {
         maker: this.minter1.address,
         tokenAddress: this.Meme721.address,
         tokenID: 0,
         price: bigNum(1),
         tokenAmount: 1,
         isETH: true
      };

      console.log(await this.marketplace.getEncodeData());

      const signedMakeOrder = await signMakeOrder(
         this.minter1,
         this.marketplace.address,
         makeOrder
      );

      console.log(await this.marketplace.testSign(
         signedMakeOrder
      ));
      // console.log(await this.marketplace.testGet(signedMakeOrder));
   })

})