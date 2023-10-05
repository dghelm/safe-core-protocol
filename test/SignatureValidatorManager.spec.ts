import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import hre, { deployments } from "hardhat";
import { getRegistry, getSafeProtocolManager, getSignatureValidatorManager } from "./utils/contracts";
import { MaxUint256 } from "ethers";
import { MODULE_TYPE_FUNCTION_HANDLER } from "../src/utils/constants";
import { expect } from "chai";

describe("SignatureValidatorManager", () => {
    let deployer: SignerWithAddress, owner: SignerWithAddress;

    before(async () => {
        [deployer, owner] = await hre.ethers.getSigners();
    });

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const safeProtocolSignatureValidatorManager = await getSignatureValidatorManager();
        const safeProtocolManager = await getSafeProtocolManager();

        const safeProtocolRegistry = await getRegistry();
        await safeProtocolRegistry.connect(owner).addModule(safeProtocolSignatureValidatorManager.target, MODULE_TYPE_FUNCTION_HANDLER);

        return { safeProtocolSignatureValidatorManager, safeProtocolManager, safeProtocolRegistry };
    });

    it("Should revert if signature validator is not registered", async () => {
        const { safeProtocolSignatureValidatorManager, safeProtocolManager } = await setupTests();
        const account = await hre.ethers.deployContract("TestExecutor", [safeProtocolManager.target], { signer: deployer });
        await account.setFallbackHandler(safeProtocolManager.target);

        const setFunctionHandlerData = safeProtocolManager.interface.encodeFunctionData("setFunctionHandler", [
            "0x1626ba7e",
            safeProtocolSignatureValidatorManager.target,
        ]);
        await account.executeCallViaMock(account.target, 0, setFunctionHandlerData, MaxUint256);

        const isValidSignatureInterface = new hre.ethers.Interface([
            "function isValidSignature(bytes32,bytes) public view returns (bytes4)",
        ]);

       const safeSignatureFragment = new hre.ethers.Interface([`function safeSignature(bytes32,bytes32,bytes,bytes)`]);
       const encodedMessage = safeSignatureFragment.encodeFunctionData("safeSignature(bytes32,bytes32,bytes,bytes)", [
        hre.ethers.randomBytes(32),hre.ethers.randomBytes(32), hre.ethers.randomBytes(20), hre.ethers.randomBytes(64)
       ]);

        const data = isValidSignatureInterface.encodeFunctionData("isValidSignature", [
            hre.ethers.randomBytes(32),
            encodedMessage,
        ]);

        await expect(account.executeCallViaMock(account.target, 0, data, MaxUint256))
            .to.be.revertedWithCustomError(safeProtocolSignatureValidatorManager, "SignatureValidatorNotSet")
            .withArgs(account.target);
    });

    it.skip("Should call signature validator", async () => {
        const { safeProtocolSignatureValidatorManager, safeProtocolManager } = await setupTests();
        const account = await hre.ethers.deployContract("TestExecutor", [safeProtocolManager.target], { signer: deployer });

        const setFunctionHandlerData = safeProtocolManager.interface.encodeFunctionData("setFunctionHandler", [
            "0x1626ba7e",
            safeProtocolSignatureValidatorManager.target,
        ]);
        await account.executeCallViaMock(account.target, 0, setFunctionHandlerData, MaxUint256);

        const mockSignatureValidator = await hre.ethers.deployContract("MockContract");

        const dataSetSignatureValidator = safeProtocolSignatureValidatorManager.interface.encodeFunctionData("setSignatureValidator", [
            hre.ethers.randomBytes(32),
            mockSignatureValidator.target,
        ]);

        await account.executeCallViaMock(account.target, 0, dataSetSignatureValidator, MaxUint256);
    });
});
