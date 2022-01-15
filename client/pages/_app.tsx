import '../styles/globals.css'
import { AppProps } from 'next/app'
import { ChakraProvider } from '@chakra-ui/react'
import { GlobalStore } from '../store'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <GlobalStore>
        <ChakraProvider>
            <Component {...pageProps} />
        </ChakraProvider>
    </GlobalStore>
)
}

export default MyApp
