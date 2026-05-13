'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CourseManageForm from '../../../../components/CourseManageForm'
import { getStoredUser } from '../../../../lib/api'

export default function UpdateCoursePage() {
  const params = useParams()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const user = getStoredUser()

    if (!user) {
      router.replace(`/auth?redirect=/dashboard/courses/${params.id}`)
      return
    }

    if (!['admin', 'instructor'].includes(user.role)) {
      router.replace('/')
      return
    }

    setAuthorized(true)
  }, [router, params.id])

  if (!authorized) return null

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Cập nhật khóa học
        </h1>
      </div>

      <CourseManageForm courseId={params.id} />
    </section>
  )
}