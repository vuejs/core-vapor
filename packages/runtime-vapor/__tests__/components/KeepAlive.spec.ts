describe.todo('KeepAlive', () => {
  test.todo('should preserve state', async () => {})

  test.todo('should call correct lifecycle hooks', async () => {})

  test.todo(
    'should call correct lifecycle hooks when toggle the KeepAlive first',
    async () => {},
  )

  test.todo('should call lifecycle hooks on nested components', async () => {})

  test.todo(
    'should call lifecycle hooks on nested components when root component no hooks',
    async () => {},
  )

  test.todo('should call correct hooks for nested keep-alive', async () => {})

  describe.todo('props', () => {
    test.todo('include (string)', async () => {})

    test.todo('include (regex)', async () => {})

    test.todo('include (array)', async () => {})

    test.todo('exclude (string)', async () => {})

    test.todo('exclude (regex)', async () => {})

    test.todo('exclude (array)', async () => {})

    test.todo('include + exclude', async () => {})

    test.todo('max', async () => {})
  })

  describe.todo('cache invalidation', () => {
    test('on include change', async () => {
      test.todo('on exclude change', async () => {})

      test.todo('on include change + view switch', async () => {})

      test.todo('on exclude change + view switch', async () => {})

      test.todo('should not prune current active instance', async () => {})

      // vuejs/vue #6938
      test.todo(
        'should not cache anonymous component when include is specified',
        async () => {},
      )

      test.todo(
        'should cache anonymous components if include is not specified',
        async () => {},
      )

      // vuejs/vue #7105
      test.todo(
        'should not destroy active instance when pruning cache',
        async () => {},
      )

      test.todo(
        'should update re-activated component if props have changed',
        async () => {},
      )
    })
  })

  it.todo('should call correct vnode hooks', async () => {})

  // vuejs/core #1511
  test.todo(
    'should work with cloned root due to scopeId / fallthrough attrs',
    async () => {},
  )

  test.todo('should work with async component', async () => {})

  // vuejs/core #4976
  test.todo('handle error in async onActivated', async () => {})

  // vuejs/core #3648
  test.todo('should avoid unmount later included components', async () => {})
})
