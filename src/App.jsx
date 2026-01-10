import SlideshowView from './views/SlideshowView'
import { ConfigProvider } from './context/ConfigContext'

function App() {
    return (
        <ConfigProvider>
            <SlideshowView />
        </ConfigProvider>
    )
}

export default App
