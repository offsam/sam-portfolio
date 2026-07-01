'use client'

import dynamic from 'next/dynamic'

const SpherePoints = dynamic(() => import('@/components/SpherePoints'), { ssr: false })

export default function Home() {
  return <SpherePoints />
}
