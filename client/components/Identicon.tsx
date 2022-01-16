import { useEffect, useRef, useContext } from "react";
import styled from "@emotion/styled";
import jazzicon from "@metamask/jazzicon";
import { globalContext } from "../store";

const StyledIdenticon = styled.div`
  height: 1rem;
  width: 1rem;
  border-radius: 1.125rem;
  background-color: black;
`;

export default function Identicon() {
  const ref = useRef<HTMLDivElement>();
  const { globalState, dispatch } = useContext(globalContext);
  const { account } = globalState;

  useEffect(() => {
    if (account && ref.current) {
      ref.current.innerHTML = "";
      ref.current.appendChild(jazzicon(16, parseInt(account.slice(2, 10), 16)));
    }
  }, [account]);

  return <StyledIdenticon ref={ref as any} />;
}
