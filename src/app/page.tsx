'use client'
import { useEffect, useState } from 'react'
import { useSession, useUser, UserButton } from '@clerk/nextjs'
import { createClient } from '@supabase/supabase-js'
import * as React from 'react';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';


const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

export default function Home() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isFileTypeError, setIsFileTypeError] = useState<boolean>(false)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  // The `useUser()` hook will be used to ensure that Clerk has loaded data about the logged in user
  const { user } = useUser()
  // The `useSession()` hook will be used to get the Clerk session object
  const { session } = useSession()

  // Create a custom supabase client that injects the Clerk Supabase token into the request headers
  function createClerkSupabaseClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          // Get the custom Supabase token from Clerk
          fetch: async (url, options = {}) => {
            const clerkToken = await session?.getToken({
              template: 'supabase',
            })

            // Insert the Clerk Supabase token into the headers
            const headers = new Headers(options?.headers)
            headers.set('Authorization', `Bearer ${clerkToken}`)

            // Now call the default fetch
            return fetch(url, {
              ...options,
              headers,
            })
          },
        },
      },
    )
  }

  // Create a `client` object for accessing Supabase data using the Clerk token
  const client = createClerkSupabaseClient()

  // This `useEffect` will wait for the User object to be loaded before requesting
  // the tasks for the signed in user
  useEffect(() => {
    if (!user) return
    async function loadTasks() {
      setLoading(true)
      const { data, error } = await client.from('tasks').select()
      if (!error) setTasks(data)
      setLoading(false)
    }

    loadTasks()
  }, [user])

  // Add a task into the "tasks" database
  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) {
      console.error('No file selected');
      return;
    }
    const imageFile = file

    if (!user) {
      console.error('User is not defined');
      return;
    }
    const fileName = `${crypto.randomUUID()}`


    const { error: upError } = await client.storage
      .from('tasks_image')
      .upload(fileName, imageFile)

    if (upError) { console.error('Error uploading file: ', upError.message) }

    const { data: urlData } = await client.storage
      .from('tasks_image')
      .getPublicUrl(fileName)


    await client.from('tasks').insert({
      name,
      image_url: urlData?.publicUrl,
    })
    window.location.reload()
  }

  // Update a task when its completed
  async function onCheckClicked(taskId: number, isDone: boolean) {
    await client
      .from('tasks')
      .update({
        is_done: isDone,
      })
      .eq('id', taskId)
    window.location.reload()
  }

  // Delete a task from the database
  async function deleteTask(taskId: number) {
    await client.from('tasks').delete().eq('id', taskId)
    window.location.reload()
  }

  const handleFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (e.target.files === null || e.target.files.length === 0) {
      setFile(null);
      return;
    }
    setIsFileTypeError(false);
    const file = e.target.files[0];

    setFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }
  return (
    <div>
      <UserButton />
      <h1>Tasks</h1>

      {loading && <p>Loading...</p>}

      {!loading &&
        tasks.length > 0 &&
        tasks.map((task: any) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={task.is_done}
              onChange={(e) => onCheckClicked(task.id, e.target.checked)}
            />
            <p>{task.name}</p>
            <button onClick={() => deleteTask(task.id)}>Delete</button>
            {task.image_url
              &&
              <img src={task.image_url} alt='task' width={100} height={100} />}
          </div>
        ))}

      {!loading && tasks.length === 0 && <p>No tasks found</p>}

      <form onSubmit={createTask}>
        <input
          autoFocus
          type="text"
          name="name"
          placeholder="Enter new task"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
        <div>
          {previewUrl ? (
            <div>
              <img src={previewUrl} alt='preview' width={100} height={100} />
            </div>
          ) : (
            null
          )
          }
          <Button
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<CloudUploadIcon />}
          >
            Upload files
            <VisuallyHiddenInput
              type="file"
              onChange={handleFile}
              multiple
              accept="*jpg, *jpeg, *png, *gif"
            />
          </Button>
        </div>
        <button type="submit">Add</button>
      </form>
    </div>
  )
}