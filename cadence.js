function e(id) { return document.getElementById(id) }

function rp(url) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest()
    req.open('GET', url, true)
    req.onload = function () {
      if (req.status >= 200 && req.status < 300) return resolve(JSON.parse(req.response))
      reject(new Error(req.statusText))
    }
    req.onerror = function () { reject(new Error('Network failure')) }
    req.send('')
  })
}

function readCookie(name) {
  const nameEQ = `${name}=`
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) == ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}

function showUser(userJwt) {
  const user = jwt_decode(userJwt)

  e('login').className = 'hidden'
  e('user').className = ''
  e('username').innerHTML = user.sub

  // Fetch run periods.
  rp(`${'https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/cadence?' +
     'user='}${userJwt}`)
    .then(data => {
      const header = document.createElement('h3')
      header.innerHTML = 'Analyzed runs'

      const ul = document.createElement('ul')
      Object.keys(data.runs).sort().forEach(date => {
        data.runs[date].forEach(run => {
          const li = document.createElement('li')
          const time = `${Math.floor(run.start / 60)}:${run.start % 60}`
          li.innerHTML = `${date} ${time}<br/>`
            + `Time spent: ${run.steps.length}<br/>`
            + `Median cadence: ${run.median}`
          li.addEventListener('click', () => { drawChart(run) })

          ul.appendChild(li)
        })
      })
      e('user').appendChild(header)
      e('user').appendChild(ul)
    })
    .catch(err => { console.log('Error', err) })
}

function awaitLogin() {
  window.addEventListener('message', event => {
    if (event.origin !== 'https://webtask.it.auth0.com') return
    document.cookie = `user=${event.data}; path=/`
    showUser(event.data)
  }, false)
}

function onLoad() {
  // Check if user is logged in.
  const userCookie = readCookie('user')
  if (userCookie) showUser(userCookie)
}

function drawChart(run) {
  e('chart').innerHTML = ''

  const canvas = document.createElement('canvas')
  e('chart').appendChild(canvas)

  const ctx    = canvas.getContext('2d')

  ctx.canvas.width  = Math.floor(window.innerWidth * 0.95)
  ctx.canvas.height = Math.floor(window.innerHeight * 0.8)

  const data = {
    labels:   run.steps.map((step, i) => i),
    datasets: [{
      label:                'Running cadence',
      fillColor:            'rgba(220,220,220,0.2)',
      strokeColor:          'rgba(220,220,220,1)',
      pointColor:           'rgba(220,220,220,1)',
      pointStrokeColor:     '#fff',
      pointHighlightFill:   '#fff',
      pointHighlightStroke: 'rgba(220,220,220,1)',
      data:                 run.steps,
    }],
  }

  console.log(data)

  const myLineChart = new Chart(ctx).Line(data, {})
}
