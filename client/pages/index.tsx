import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.css";
import ConnectButton from "../components/ConnectButton";
import ERC20Option from "../components/ERC20Option";
import Events from "../components/Events";
import { useDisclosure } from "@chakra-ui/react";

const Home: NextPage = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <div className={styles.container}>
      <div className={styles.buttonDiv}>
        <ConnectButton handleOpenModal={onOpen} />
      </div>

      <main className={styles.main}>
        <h1 className={styles.title}>ERC20 Options</h1>
        <ERC20Option />
        <Events />
      </main>

      <footer className={styles.footer}>Powered by 0xtoki</footer>
    </div>
  );
};

export default Home;
