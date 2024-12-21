import { Loader2 } from "lucide-react"

export default function createClassLoading(){
    return(
        <div className="flex flex-col items-center justify-center">
            <Loader2 className="animate-spin size-24 "/>
        </div>
    )
}