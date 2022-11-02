import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.scss";
import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { flashError, flashMsg } from "../components/utils/helpers";
import {
  config_pda,
  fetch_pdas,
  initSolanaProgram,
  PDATypes,
  SolanaProgramType,
  StatsType,
  stats_pda,
  SystemConfigType,
  SYSTEM_AUTHORITY,
  system_config_pda,
} from "@cubist-collective/cubist-games-lib";
import { ConfigInputType } from "./types/game-settings";
import { PublicKey } from "@solana/web3.js";
import useSWR from "swr";
import { fetcher, fetch_games } from "../components/utils/requests";
import { useConnection } from "@solana/wallet-adapter-react";
import { GamesByStateType, GameType } from "./types/game";
import { game_batch, game_state } from "../components/utils/game";
import { fetch_configs } from "../components/utils/game-settings";
import slugify from "slugify";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
const Button = dynamic(() => import("../components/button"));

const Home: NextPage = () => {
  const { data: idl } = useSWR("/api/idl", fetcher);
  const { connection } = useConnection();
  const [pdas, setPdas] = useState<PDATypes | null>(null);
  const [openGames, setOpenGames] = useState<GameType[]>([]);
  const [closedGames, setClosedGames] = useState<GameType[]>([]);
  const [settledGames, setSettledGames] = useState<GameType[]>([]);
  const [nextGameId, setNextGameId] = useState<number>(0);
  const [authority, _setAuthority] = useState<PublicKey>(
    new PublicKey(process.env.NEXT_PUBLIC_AUTHORITY as string)
  );
  const [solanaProgram, setSolanaProgram] = useState<SolanaProgramType | null>(
    null
  );
  const [systemConfig, setSystemConfig] = useState<SystemConfigType | null>(
    null
  );
  const [config, setConfig] = useState<ConfigInputType | null>(null);
  const [stats, setStats] = useState<StatsType | null>(null);

  const fetchMoreGames = async (
    gamesByState: GamesByStateType,
    batchSize: number,
    lastGameId: number
  ): Promise<GamesByStateType> => {
    const gamesIds = game_batch(lastGameId, batchSize);
    let state = null;
    for (const game of await fetch_games(
      solanaProgram as SolanaProgramType,
      authority,
      gamesIds
    )) {
      state = game_state(game.data);
      gamesByState[state === "Voided" ? "Settled" : state].push(game);
    }
    const nextGameId = gamesIds.length ? gamesIds[gamesIds.length - 1] - 1 : 0;
    setNextGameId(nextGameId);
    // If the last game is not settled, keep fetching:
    if (nextGameId && state != "Settled") {
      return fetchMoreGames(gamesByState, batchSize, nextGameId);
    }
    // Set Games
    for (const [state, games] of Object.entries(gamesByState)) {
      switch (state) {
        case "Open":
          setOpenGames(games);
          break;
        case "Closed":
          setClosedGames(games);
          break;
        default:
          setSettledGames(games);
      }
    }
    return gamesByState;
  };
  // STEP 1 - Init Program and PDAs
  useEffect(() => {
    if (!connection || solanaProgram || !idl || pdas) return;
    (async () => {
      setPdas(
        await flashError(fetch_pdas, [
          ["systemConfig", system_config_pda, SYSTEM_AUTHORITY],
          ["config", config_pda, authority],
          ["stats", stats_pda, authority],
        ])
      );
      setSolanaProgram(
        await initSolanaProgram(
          JSON.parse(idl),
          connection,
          new PhantomWalletAdapter()
        )
      );
    })();
  }, [connection, idl, solanaProgram, authority, pdas]);

  // STEP 2 - Fetch Configs
  useEffect(() => {
    if (!solanaProgram || !pdas || systemConfig) return;
    (async () => {
      if (
        !(await fetch_configs(
          config as ConfigInputType,
          solanaProgram,
          pdas,
          setSystemConfig,
          setConfig,
          setStats,
          9
        ))
      ) {
        flashMsg("The site is not configured yet");
      }
    })();
  }, [solanaProgram, pdas]);

  // STEP 3 - Fetch Games
  useEffect(() => {
    if (!stats || !solanaProgram || !config || !pdas) return;
    (async () => {
      const batchSize = 10;
      const gamesByState: GamesByStateType = {
        Open: [],
        Closed: [],
        Settled: [],
      };
      await fetchMoreGames(
        gamesByState,
        batchSize,
        (stats as StatsType).totalGames.toNumber()
      );
    })();
  }, [stats]);

  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>List of Games</h1>
        <div className={styles.grid}>
          <div>
            <h2>Open Games</h2>
            <ul>
              {openGames.map((game: GameType, k: number) => (
                <li key={`openGames${k}`}>
                  <a
                    href={`/game/${slugify(
                      game.cached.definition?.title as string,
                      { lower: true }
                    )}?id=${game.data.gameId}`}
                  >
                    {game.cached.definition?.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>{" "}
          <div>
            <h2>Closed Games</h2>
            <ul>
              {closedGames.map((game: GameType, k: number) => (
                <li key={`closedGames${k}`}>
                  <a
                    href={`/game/${slugify(
                      game.cached.definition?.title as string,
                      { lower: true }
                    )}?id=${game.data.gameId}`}
                  >
                    {game.cached.definition?.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>{" "}
          <div>
            <h2>Settled Games</h2>
            <ul>
              {settledGames.map((game: GameType, k: number) => (
                <li key={`settledGames${k}`}>
                  <a
                    href={`/game/${slugify(
                      game.cached.definition?.title as string,
                      { lower: true }
                    )}?id=${game.data.gameId}`}
                  >
                    {game.cached.definition?.title}
                  </a>
                </li>
              ))}
            </ul>
            {nextGameId ? (
              <div>
                <Button
                  onClick={() =>
                    fetchMoreGames(
                      {
                        Open: openGames,
                        Closed: closedGames,
                        Settled: settledGames,
                      },
                      10,
                      nextGameId
                    )
                  }
                ></Button>
              </div>
            ) : (
              ""
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
