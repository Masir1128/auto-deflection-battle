import { onMounted, onUnmounted, ref } from 'vue'
import Matter from 'matter-js'
import { useGameStore } from '../stores/gameStore'

export function usePhysics(canvasRef: any) {
  const gameStore = useGameStore()
  
  // Matter.js 引擎组件
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0 } // 无重力环境
  })
  const runner = Matter.Runner.create()
  const world = engine.world
  
  // 物理世界中的对象
  const walls: Matter.Body[] = []
  const playerBodies: Record<string, Matter.Body> = {}
  const itemBodies: Record<string, Matter.Body> = {}
  
  // 引擎状态
  const isRunning = ref(false)
  
  // 基础速度值
  const baseSpeed = 7
  
  // 同步物理引擎位置到游戏状态
  function syncPhysicsToState() {
    // 同步玩家位置
    gameStore.players.forEach(player => {
      const body = playerBodies[player.id]
      if (body) {
        // 更新游戏状态中的位置
        player.position.x = body.position.x
        player.position.y = body.position.y
        
        // 保持玩家的速度恒定
        const currentSpeed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y)
        const targetSpeed = baseSpeed * player.speedFactor
        
        // 只在速度差异较大时调整
        if (Math.abs(currentSpeed - targetSpeed) > 0.5) {
          const angle = currentSpeed > 0 
            ? Math.atan2(body.velocity.y, body.velocity.x) 
            : Math.random() * Math.PI * 2
          
          Matter.Body.setVelocity(body, {
            x: Math.cos(angle) * targetSpeed,
            y: Math.sin(angle) * targetSpeed
          })
        }
      }
    })

    // 同步道具位置
    gameStore.items.forEach(item => {
      const body = itemBodies[item.id]
      if (body) {
        // 更新游戏状态中的位置
        item.position.x = body.position.x
        item.position.y = body.position.y
        
        if (item.velocity) {
          item.velocity.x = body.velocity.x
          item.velocity.y = body.velocity.y
        }
      }
    })
  }
  
  // 初始化物理世界
  function initPhysics() {
    console.log('初始化物理引擎')
    const canvas = canvasRef.value
    if (!canvas) {
      console.error('Canvas元素未找到')
      return
    }
    
    const width = canvas.width
    const height = canvas.height
    console.log(`画布尺寸: ${width}x${height}`)
    
    // 创建游戏边界墙
    const wallOptions = { 
      isStatic: true,
      restitution: 1.1, // 超过1的弹性，让碰撞更有活力
      friction: 0
    }
    
    // 上边界
    walls.push(Matter.Bodies.rectangle(width / 2, 0, width, 10, wallOptions))
    // 下边界
    walls.push(Matter.Bodies.rectangle(width / 2, height, width, 10, wallOptions))
    // 左边界
    walls.push(Matter.Bodies.rectangle(0, height / 2, 10, height, wallOptions))
    // 右边界
    walls.push(Matter.Bodies.rectangle(width, height / 2, 10, height, wallOptions))
    
    // 添加墙壁到物理世界
    Matter.Composite.add(world, walls)
    console.log('边界墙已添加')
    
    // 初始化玩家物体
    gameStore.players.forEach(player => {
      const playerBody = Matter.Bodies.circle(
        player.position.x,
        player.position.y,
        30, // 玩家半径
        {
          restitution: 1.05, // 增加弹性系数，让玩家弹射更有力
          friction: 0, // 减少摩擦力，让移动更顺畅
          frictionAir: 0, // 无空气摩擦，让速度保持稳定
          label: `player_${player.id}`,
          isStatic: false, // 玩家是动态的，可以移动
          mass: 5, // 减小质量，使玩家移动更快
          inertia: Infinity // 防止旋转
        }
      )
      
      playerBodies[player.id] = playerBody
      Matter.Composite.add(world, playerBody)
      console.log(`玩家${player.id}物理对象已创建`)
      
      // 给玩家设置初始随机速度，开始弹射
      const angle = Math.random() * Math.PI * 2
      const speed = baseSpeed * player.speedFactor
      Matter.Body.setVelocity(playerBody, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      })
    })
    
    // 设置碰撞检测
    Matter.Events.on(engine, 'collisionStart', handleCollisions)
    
    // 启动引擎更新循环
    startPhysicsLoop()
  }
  
  // 开始物理模拟循环
  function startPhysicsLoop() {
    console.log('启动物理模拟循环')
    isRunning.value = true
    Matter.Runner.run(runner, engine)
    
    // 添加引擎更新后事件，用于同步物理位置到游戏状态
    Matter.Events.on(engine, 'afterUpdate', syncPhysicsToState)
  }
  
  // 停止物理模拟
  function stopPhysicsLoop() {
    console.log('停止物理模拟循环')
    isRunning.value = false
    Matter.Events.off(engine, 'afterUpdate', syncPhysicsToState)
    Matter.Runner.stop(runner)
  }
  
  // 更新玩家速度
  function updatePlayerSpeed(playerId: string, speedFactor: number) {
    const playerBody = playerBodies[playerId]
    if (playerBody) {
      const currentVelocity = playerBody.velocity
      const currentSpeed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y)
      const currentAngle = Math.atan2(currentVelocity.y, currentVelocity.x)
      
      const newSpeed = baseSpeed * speedFactor
      Matter.Body.setVelocity(playerBody, {
        x: Math.cos(currentAngle) * newSpeed,
        y: Math.sin(currentAngle) * newSpeed
      })
    }
  }
  
  // 创建齿轮
  function createGear(x: number, y: number) {
    if (!gameStore.gameStarted || gameStore.gameEnded) return
    
    // 检查是否已经存在齿轮
    const existingGear = gameStore.items.find(item => item.type === 'gear')
    if (existingGear) {
      console.log('场上已存在齿轮，不再创建新齿轮')
      return null
    }
    
    // 检查是否有玩家已经拥有齿轮
    const playerWithGear = gameStore.players.find(player => player.hasGear)
    if (playerWithGear) {
      console.log(`玩家${playerWithGear.id}已拥有齿轮，不再创建新齿轮`)
      return null
    }
    
    // 使用智能位置生成
    const position = getSmartGearPosition()
    
    console.log(`创建齿轮, 位置(${position.x}, ${position.y})`)
    
    // 先添加到游戏状态并获取ID
    const itemId = gameStore.addItem('gear', position, { x: 2, y: 2 })
    
    // 创建物理体
    const gearBody = Matter.Bodies.circle(position.x, position.y, 15, {
      restitution: 1, // 完全弹性
      friction: 0,
      frictionAir: 0, // 无空气阻力
      label: `item_${itemId}`,
      mass: 0.5, // 较轻质量
      isStatic: true // 齿轮开始时是静态的，玩家碰到后会附着在玩家上
    })
    
    // 添加到世界和缓存
    itemBodies[itemId] = gearBody
    Matter.Composite.add(world, gearBody)
    
    // 设置7秒后如果齿轮仍存在，改变位置
    setTimeout(() => {
      const gear = gameStore.items.find(item => item.id === itemId && item.type === 'gear')
      if (gear) {
        console.log("齿轮7秒未被拾取，改变位置")
        // 获取两个玩家的中间位置
        const player1 = gameStore.players[0];
        const player2 = gameStore.players[1];
        const midX = (player1.position.x + player2.position.x) / 2;
        const midY = (player1.position.y + player2.position.y) / 2;
        
        // 在中间位置附近生成，增加碰撞概率
        const offsetX = (Math.random() - 0.5) * 100;
        const offsetY = (Math.random() - 0.5) * 100;
        
        const canvas = canvasRef.value;
        const newPosition = {
          x: Math.max(30, Math.min(canvas.width - 30, midX + offsetX)),
          y: Math.max(30, Math.min(canvas.height - 30, midY + offsetY))
        };
        
        // 更新位置
        gear.position.x = newPosition.x;
        gear.position.y = newPosition.y;
        
        // 更新物理体位置
        const gearBody = itemBodies[itemId];
        if (gearBody) {
          Matter.Body.setPosition(gearBody, newPosition);
        }
      }
    }, 7000);
    
    console.log(`齿轮已创建, ID: ${itemId}`)
    return itemId
  }
  
  // 获取智能齿轮生成位置
  function getSmartGearPosition() {
    const canvas = canvasRef.value
    if (!canvas) {
      // 如果没有canvas，返回随机位置
      return { 
        x: Math.random() * 500 + 50, 
        y: Math.random() * 300 + 50 
      }
    }
    
    // 获取玩家位置和速度
    const players = gameStore.players.map(player => {
      const body = playerBodies[player.id]
      return {
        id: player.id,
        position: { ...player.position },
        velocity: body ? { ...body.velocity } : { x: 0, y: 0 },
        hasGear: player.hasGear
      }
    })
    
    // 计算玩家之间的距离
    const distance = Math.sqrt(
      Math.pow(players[0].position.x - players[1].position.x, 2) +
      Math.pow(players[0].position.y - players[1].position.y, 2)
    )
    
    // 检测是否可能存在死循环（两个玩家接近且都在边界附近运动）
    const player1NearEdge = isNearEdge(players[0].position, canvas, 60);
    const player2NearEdge = isNearEdge(players[1].position, canvas, 60);
    
    // 如果两个玩家都在边缘且距离较远，生成在它们之间
    if (player1NearEdge && player2NearEdge && distance > 150) {
      // 直接放在画布中心区域，打破可能的死循环
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // 在中心区域添加一些随机偏移
      const offsetX = (Math.random() - 0.5) * 100;
      const offsetY = (Math.random() - 0.5) * 100;
      
      return {
        x: centerX + offsetX,
        y: centerY + offsetY
      }
    }
    
    // 如果玩家距离很远(超过200)，增加在中间区域生成的概率
    if (distance > 200 && Math.random() < 0.7) {
      // 计算中点位置
      const midX = (players[0].position.x + players[1].position.x) / 2
      const midY = (players[0].position.y + players[1].position.y) / 2
      
      // 在中点附近区域生成，但保持一定距离
      const offsetX = (Math.random() - 0.5) * 180
      const offsetY = (Math.random() - 0.5) * 180
      
      return {
        x: Math.max(30, Math.min(canvas.width - 30, midX + offsetX)),
        y: Math.max(30, Math.min(canvas.height - 30, midY + offsetY))
      }
    }
    
    // 预测玩家的落脚点，而不是直接预测玩家位置
    const futurePositions = players.map(player => {
      // 计算速度向量的标准化方向
      const velocityMagnitude = Math.sqrt(
        player.velocity.x * player.velocity.x + 
        player.velocity.y * player.velocity.y
      )
      
      if (velocityMagnitude < 0.1) {
        // 如果几乎静止，就在周围随机一个位置
        return {
          x: player.position.x + (Math.random() - 0.5) * 120,
          y: player.position.y + (Math.random() - 0.5) * 120
        }
      }
      
      // 标准化方向向量
      const dirX = player.velocity.x / velocityMagnitude
      const dirY = player.velocity.y / velocityMagnitude
      
      // 预测出一个远一点的位置 (60-120帧后的位置)
      const predictionFrames = 60 + Math.random() * 60
      
      // 计算预测位置
      let predictedX = player.position.x + dirX * velocityMagnitude * predictionFrames / 60
      let predictedY = player.position.y + dirY * velocityMagnitude * predictionFrames / 60
      
      // 检查是否会碰到边界，如果是则反弹
      const radius = 30 // 玩家半径
      
      // 水平边界反弹
      if (predictedX - radius < 0) {
        // 从左边界反弹
        const distToWall = player.position.x
        const timeToWall = distToWall / Math.abs(dirX * velocityMagnitude)
        const remainingTime = predictionFrames / 60 - timeToWall
        predictedX = radius + remainingTime * Math.abs(dirX * velocityMagnitude)
      } else if (predictedX + radius > canvas.width) {
        // 从右边界反弹
        const distToWall = canvas.width - player.position.x
        const timeToWall = distToWall / Math.abs(dirX * velocityMagnitude)
        const remainingTime = predictionFrames / 60 - timeToWall
        predictedX = canvas.width - radius - remainingTime * Math.abs(dirX * velocityMagnitude)
      }
      
      // 垂直边界反弹
      if (predictedY - radius < 0) {
        // 从上边界反弹
        const distToWall = player.position.y
        const timeToWall = distToWall / Math.abs(dirY * velocityMagnitude)
        const remainingTime = predictionFrames / 60 - timeToWall
        predictedY = radius + remainingTime * Math.abs(dirY * velocityMagnitude)
      } else if (predictedY + radius > canvas.height) {
        // 从下边界反弹
        const distToWall = canvas.height - player.position.y
        const timeToWall = distToWall / Math.abs(dirY * velocityMagnitude)
        const remainingTime = predictionFrames / 60 - timeToWall
        predictedY = canvas.height - radius - remainingTime * Math.abs(dirY * velocityMagnitude)
      }
      
      return {
        x: predictedX,
        y: predictedY
      }
    })
    
    // 随机选择一个玩家的预测位置
    const selectedPosition = futurePositions[Math.floor(Math.random() * futurePositions.length)]
    
    // 确保齿轮和预测位置有一定距离，让用户能看到吃齿轮的过程
    const minDistanceFromPlayer = 80 // 最小距离
    
    // 从预测位置往回退一些，确保玩家能看到吃齿轮的过程
    const playerPos = players[futurePositions.indexOf(selectedPosition)].position
    const directionX = selectedPosition.x - playerPos.x
    const directionY = selectedPosition.y - playerPos.y
    
    // 计算距离
    const totalDistance = Math.sqrt(directionX * directionX + directionY * directionY)
    
    // 确保不会生成在玩家太近的位置
    if (totalDistance < minDistanceFromPlayer) {
      // 如果预测位置太近，则直接在随机方向上生成
      const randomAngle = Math.random() * Math.PI * 2
      return {
        x: Math.max(30, Math.min(canvas.width - 30, playerPos.x + Math.cos(randomAngle) * minDistanceFromPlayer)),
        y: Math.max(30, Math.min(canvas.height - 30, playerPos.y + Math.sin(randomAngle) * minDistanceFromPlayer))
      }
    }
    
    // 取中途点，而不是终点
    const ratio = 0.5 + Math.random() * 0.3 // 取50%-80%的位置
    const midwayX = playerPos.x + directionX * ratio
    const midwayY = playerPos.y + directionY * ratio
    
    // 给坐标添加一些随机偏移
    const offsetX = (Math.random() - 0.5) * 60
    const offsetY = (Math.random() - 0.5) * 60
    
    return {
      x: Math.max(30, Math.min(canvas.width - 30, midwayX + offsetX)),
      y: Math.max(30, Math.min(canvas.height - 30, midwayY + offsetY))
    }
  }
  
  // 检查位置是否接近边缘
  function isNearEdge(position: { x: number, y: number }, canvas: HTMLCanvasElement, threshold = 50) {
    return (
      position.x < threshold || 
      position.x > canvas.width - threshold || 
      position.y < threshold || 
      position.y > canvas.height - threshold
    );
  }
  
  // 创建爱心
  function createHeart(x: number, y: number) {
    if (!gameStore.gameStarted || gameStore.gameEnded) return
    
    console.log(`创建爱心, 位置(${x}, ${y})`)
    
    // 先添加到游戏状态并获取ID
    const itemId = gameStore.addItem('heart', { x, y })
    
    // 创建物理体
    const heartBody = Matter.Bodies.circle(x, y, 15, {
      restitution: 0.5,
      friction: 0.1,
      isStatic: true, // 爱心不移动
      label: `item_${itemId}`
    })
    
    // 添加到世界和缓存
    itemBodies[itemId] = heartBody
    Matter.Composite.add(world, heartBody)
    
    console.log(`爱心已创建, ID: ${itemId}`)
    return itemId
  }
  
  // 移除道具
  function removeItem(itemId: string) {
    if (itemBodies[itemId]) {
      Matter.Composite.remove(world, itemBodies[itemId])
      delete itemBodies[itemId]
      gameStore.removeItem(itemId)
      console.log(`道具已移除, ID: ${itemId}`)
    }
  }
  
  // 游戏启动时初始化
  function startGame() {
    console.log('游戏启动')
    // 先清理所有的道具
    Object.keys(itemBodies).forEach(removeItem)
    
    // 启动游戏
    gameStore.startGame()
    
    // 给玩家设置初始速度
    gameStore.players.forEach(player => {
      const playerBody = playerBodies[player.id]
      if (playerBody) {
        // 确保玩家不会只在水平或垂直方向运动
        let angle = Math.random() * Math.PI * 2
        // 避免接近水平或垂直的角度
        while (
          Math.abs(Math.cos(angle)) < 0.3 || // 避免接近垂直
          Math.abs(Math.sin(angle)) < 0.3 || // 避免接近水平
          Math.abs(Math.cos(angle)) > 0.95 || // 避免完全水平
          Math.abs(Math.sin(angle)) > 0.95    // 避免完全垂直
        ) {
          angle = Math.random() * Math.PI * 2
        }
        
        const speed = baseSpeed * player.speedFactor
        Matter.Body.setVelocity(playerBody, {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        })
      }
    })
    
    // 缩短游戏时间到1分30秒
    gameStore.gameTimer = 90
    
    // 在1~2秒后生成第一个齿轮
    setTimeout(() => {
      if (gameStore.gameStarted) {
        createGear(0, 0)
      }
    }, 1000 + Math.random() * 1000)
    
    // 在3~5秒后生成第一个爱心
    setTimeout(() => {
      if (gameStore.gameStarted) {
        createHeart(
          Math.random() * (canvasRef.value.width - 50) + 25,
          Math.random() * (canvasRef.value.height - 50) + 25
        )
      }
    }, 3000 + Math.random() * 2000)
    
    // 添加无齿轮监控定时器
    startNoGearTimer()
    
    // 添加玩家轨迹校正定时器
    startTrajectoryCorrection()
  }
  
  // 无齿轮监控定时器
  let noGearTimerId: number | undefined = undefined
  function startNoGearTimer() {
    // 清除已有的定时器
    if (noGearTimerId) {
      clearInterval(noGearTimerId)
    }
    
    // 设置检查间隔为2秒
    noGearTimerId = setInterval(() => {
      if (!gameStore.gameStarted || gameStore.gameEnded) {
        clearInterval(noGearTimerId)
        return
      }
      
      // 检查是否有齿轮道具在场上
      const hasGearItem = gameStore.items.some(item => item.type === 'gear')
      
      // 检查是否有玩家持有齿轮
      const hasPlayerWithGear = gameStore.players.some(player => player.hasGear)
      
      // 只有在场上没有齿轮且没有玩家持有齿轮时才生成新齿轮
      if (!hasGearItem && !hasPlayerWithGear) {
        console.log('未检测到齿轮，生成新齿轮')
        createGear(0, 0)
      }
    }, 2000)
  }
  
  // 玩家轨迹校正定时器
  let trajectoryCorrectionId: number | undefined = undefined
  function startTrajectoryCorrection() {
    // 清除已有的定时器
    if (trajectoryCorrectionId) {
      clearInterval(trajectoryCorrectionId)
    }
    
    let deadlockDetectionCount = 0;
    let lastPositions = gameStore.players.map(p => ({ ...p.position }));
    let lastEncounterTime = Date.now();
    
    // 每2秒检查一次玩家轨迹
    trajectoryCorrectionId = setInterval(() => {
      if (!gameStore.gameStarted || gameStore.gameEnded) {
        clearInterval(trajectoryCorrectionId)
        return
      }
      
      // 计算两个玩家之间的距离
      const player1 = gameStore.players[0];
      const player2 = gameStore.players[1];
      const distance = Math.sqrt(
        Math.pow(player1.position.x - player2.position.x, 2) +
        Math.pow(player1.position.y - player2.position.y, 2)
      );
      
      // 如果玩家靠近，更新最后接触时间
      if (distance < 150) {
        lastEncounterTime = Date.now();
      }
      
      // 检查是否超过10秒未接触
      const noEncounterTimeout = Date.now() - lastEncounterTime > 10000;
      
      // 检查玩家是否长时间在同一区域移动（死循环检测）
      const currentPositions = gameStore.players.map(p => ({ ...p.position }));
      let playersNotMovingMuch = true;
      
      // 对每个玩家，检查他们移动的距离
      for (let i = 0; i < currentPositions.length; i++) {
        const moveDistance = Math.sqrt(
          Math.pow(currentPositions[i].x - lastPositions[i].x, 2) +
          Math.pow(currentPositions[i].y - lastPositions[i].y, 2)
        );
        
        // 如果任何玩家移动了相当距离，认为没有死锁
        if (moveDistance > 70) {
          playersNotMovingMuch = false;
          break;
        }
      }
      
      // 保存当前位置用于下次检查
      lastPositions = currentPositions;
      
      // 如果玩家都没怎么移动，增加死锁计数
      if (playersNotMovingMuch) {
        deadlockDetectionCount++;
        console.log("可能的死锁检测:", deadlockDetectionCount);
      } else {
        // 重置死锁计数
        deadlockDetectionCount = 0;
      }
      
      // 如果连续3次检测到潜在死锁或10秒未相遇，强制改变所有玩家的方向
      if (deadlockDetectionCount >= 3 || noEncounterTimeout) {
        console.log("检测到死锁或长时间未相遇，强制改变轨迹");
        
        // 计算两个玩家之间的中心点
        const midX = (player1.position.x + player2.position.x) / 2;
        const midY = (player1.position.y + player2.position.y) / 2;
        
        // 修改两个玩家的方向，使其朝向中心点附近
        gameStore.players.forEach((player, index) => {
          const playerBody = playerBodies[player.id];
          if (playerBody) {
            // 计算从玩家到中心点的方向
            const toMidX = midX - player.position.x;
            const toMidY = midY - player.position.y;
            
            // 计算基础角度
            const baseAngle = Math.atan2(toMidY, toMidX);
            
            // 添加一些随机性，让两个玩家不会直接相撞
            const randomOffset = (index === 0 ? 1 : -1) * (Math.PI / 6 + Math.random() * Math.PI / 6);
            const newAngle = baseAngle + randomOffset;
            
            // 设置新速度，直奔中间区域
            const speed = baseSpeed * player.speedFactor;
            Matter.Body.setVelocity(playerBody, {
              x: Math.cos(newAngle) * speed,
              y: Math.sin(newAngle) * speed
            });
          }
        });
        
        // 重置死锁计数和最后接触时间
        deadlockDetectionCount = 0;
        lastEncounterTime = Date.now();
        
        // 如果场上有齿轮，也改变齿轮位置
        const existingGear = gameStore.items.find(item => item.type === 'gear');
        if (existingGear) {
          const canvas = canvasRef.value;
          if (canvas) {
            // 移除旧齿轮
            const gearId = existingGear.id;
            removeItem(gearId);
            
            // 短暂延迟后创建新齿轮（在中心区域）
            setTimeout(() => {
              if (gameStore.gameStarted && !gameStore.gameEnded) {
                // 直接在中心区域创建
                const x = midX + (Math.random() - 0.5) * 60;
                const y = midY + (Math.random() - 0.5) * 60;
                createGear(x, y);
              }
            }, 300);
          }
        }
      }
      
      // 正常的轨迹校正逻辑
      gameStore.players.forEach(player => {
        const playerBody = playerBodies[player.id]
        if (playerBody) {
          const vx = playerBody.velocity.x
          const vy = playerBody.velocity.y
          const speed = Math.sqrt(vx * vx + vy * vy)
          
          // 检查是否存在接近垂直或水平的运动
          const isNearHorizontal = Math.abs(vy) < 0.5
          const isNearVertical = Math.abs(vx) < 0.5
          
          if (isNearHorizontal || isNearVertical) {
            console.log(`检测到玩家${player.id}轨迹过于直线，进行轨迹校正`)
            
            // 生成一个新的角度，保证不是水平或垂直的
            let newAngle = Math.atan2(vy, vx) + (Math.random() * 0.5 - 0.25) * Math.PI
            
            // 确保新角度不接近水平或垂直
            if (Math.abs(Math.cos(newAngle)) < 0.3 || Math.abs(Math.sin(newAngle)) < 0.3) {
              newAngle += Math.PI / 4 // 旋转45度
            }
            
            // 设置新速度
            Matter.Body.setVelocity(playerBody, {
              x: Math.cos(newAngle) * speed,
              y: Math.sin(newAngle) * speed
            })
          }
        }
      })
    }, 2000)
  }
  
  // 碰撞后检查玩家速度并修正
  function adjustPlayerVelocityAfterCollision(playerBody: Matter.Body, player: any) {
    const targetSpeed = baseSpeed * player.speedFactor
    const currentVel = playerBody.velocity
    const currentSpeed = Math.sqrt(currentVel.x * currentVel.x + currentVel.y * currentVel.y)
    
    // 检查速度方向，避免纯水平或纯垂直运动
    const isNearHorizontal = Math.abs(currentVel.y) < 0.5
    const isNearVertical = Math.abs(currentVel.x) < 0.5
    
    if (Math.abs(currentSpeed - targetSpeed) > 0.5 || isNearHorizontal || isNearVertical) {
      let angle = Math.atan2(currentVel.y, currentVel.x)
      
      // 如果接近水平或垂直，添加一些随机偏移
      if (isNearHorizontal || isNearVertical) {
        // 添加一个随机的偏移角度 (±15度)
        angle += (Math.random() - 0.5) * Math.PI / 6
      }
      
      Matter.Body.setVelocity(playerBody, {
        x: Math.cos(angle) * targetSpeed,
        y: Math.sin(angle) * targetSpeed
      })
    }
  }
  
  // 处理碰撞事件
  function handleCollisions(event: Matter.IEventCollision<Matter.Engine>) {
    const pairs = event.pairs
    
    pairs.forEach(pair => {
      const { bodyA, bodyB } = pair
      const labelA = bodyA.label
      const labelB = bodyB.label
      
      // 检查是否为齿轮与玩家碰撞
      if (labelA.startsWith('item_gear_') && labelB.startsWith('player_')) {
        const itemId = labelA.replace('item_', '')
        const playerId = labelB.replace('player_', '')
        handleGearPlayerCollision(itemId, playerId)
      } 
      else if (labelB.startsWith('item_gear_') && labelA.startsWith('player_')) {
        const itemId = labelB.replace('item_', '')
        const playerId = labelA.replace('player_', '')
        handleGearPlayerCollision(itemId, playerId)
      }
      
      // 检查是否为爱心与玩家碰撞
      if (labelA.startsWith('item_heart_') && labelB.startsWith('player_')) {
        const itemId = labelA.replace('item_', '')
        const playerId = labelB.replace('player_', '')
        handleHeartPlayerCollision(itemId, playerId)
      } 
      else if (labelB.startsWith('item_heart_') && labelA.startsWith('player_')) {
        const itemId = labelB.replace('item_', '')
        const playerId = labelA.replace('player_', '')
        handleHeartPlayerCollision(itemId, playerId)
      }
      
      // 检查携带齿轮的玩家是否撞到另一个玩家
      if (labelA.startsWith('player_') && labelB.startsWith('player_')) {
        const playerIdA = labelA.replace('player_', '')
        const playerIdB = labelB.replace('player_', '')
        
        const playerA = gameStore.players.find(p => p.id === playerIdA)
        const playerB = gameStore.players.find(p => p.id === playerIdB)
        
        // 计算碰撞后的反弹角度，使其更有利于再次相遇
        const posA = bodyA.position;
        const posB = bodyB.position;
        const velA = bodyA.velocity;
        const velB = bodyB.velocity;
        
        // 计算从A到B的向量
        const abVector = {
          x: posB.x - posA.x,
          y: posB.y - posA.y
        };
        
        // 向量长度
        const abLength = Math.sqrt(abVector.x * abVector.x + abVector.y * abVector.y);
        
        // 单位向量
        const abUnit = {
          x: abVector.x / abLength,
          y: abVector.y / abLength
        };
        
        // 碰撞角度 - 考虑到两个玩家之间的相对位置
        const baseAngle = Math.atan2(abUnit.y, abUnit.x);
        
        // 处理玩家之间的齿轮击中
        if (playerA?.hasGear) {
          gameStore.damagePlayer(playerIdB)
          playerA.hasGear = false
          console.log(`玩家${playerIdB}被齿轮击中`)
          
          // 齿轮命中后1~2秒重新生成
          setTimeout(() => {
            if (gameStore.gameStarted && !gameStore.gameEnded) {
              createGear(0, 0)
            }
          }, 1000 + Math.random() * 1000)
        } 
        else if (playerB?.hasGear) {
          gameStore.damagePlayer(playerIdA)
          playerB.hasGear = false
          console.log(`玩家${playerIdA}被齿轮击中`)
          
          // 齿轮命中后1~2秒重新生成
          setTimeout(() => {
            if (gameStore.gameStarted && !gameStore.gameEnded) {
              createGear(0, 0)
            }
          }, 1000 + Math.random() * 1000)
        }
        
        // 给两个玩家一个更智能的反弹角度，增加再次相遇的机会
        const speedA = Math.sqrt(velA.x * velA.x + velA.y * velA.y);
        const speedB = Math.sqrt(velB.x * velB.x + velB.y * velB.y);
        
        // 添加随机偏移，但偏向相对方向
        const offsetAngleA = (Math.random() * 0.4 - 0.2) * Math.PI; // -36到36度随机偏移
        const offsetAngleB = (Math.random() * 0.4 - 0.2) * Math.PI;
        
        // 玩家A的新角度 - 偏向球面相切方向
        const newAngleA = baseAngle + Math.PI / 2 + offsetAngleA;
        
        // 玩家B的新角度 - 偏向球面相切的反方向
        const newAngleB = baseAngle - Math.PI / 2 + offsetAngleB;
        
        // 应用新速度
        Matter.Body.setVelocity(bodyA, {
          x: Math.cos(newAngleA) * speedA,
          y: Math.sin(newAngleA) * speedA
        });
        
        Matter.Body.setVelocity(bodyB, {
          x: Math.cos(newAngleB) * speedB,
          y: Math.sin(newAngleB) * speedB
        });
      }
    })
    
    // 碰撞后恢复玩家的速度
    pairs.forEach(pair => {
      const { bodyA, bodyB } = pair
      
      if (bodyA.label.startsWith('player_')) {
        const playerId = bodyA.label.replace('player_', '')
        const player = gameStore.players.find(p => p.id === playerId)
        if (player) {
          setTimeout(() => {
            adjustPlayerVelocityAfterCollision(bodyA, player)
          }, 100) // 碰撞后短暂延迟再调整速度
        }
      }
      
      if (bodyB.label.startsWith('player_')) {
        const playerId = bodyB.label.replace('player_', '')
        const player = gameStore.players.find(p => p.id === playerId)
        if (player) {
          setTimeout(() => {
            adjustPlayerVelocityAfterCollision(bodyB, player)
          }, 100) // 碰撞后短暂延迟再调整速度
        }
      }
    })
  }
  
  // 处理齿轮与玩家碰撞
  function handleGearPlayerCollision(itemId: string, playerId: string) {
    const player = gameStore.players.find(p => p.id === playerId)
    if (player) {
      player.hasGear = true
      console.log(`玩家${playerId}获得齿轮`)
      removeItem(itemId)
    }
  }
  
  // 处理爱心与玩家碰撞
  function handleHeartPlayerCollision(itemId: string, playerId: string) {
    gameStore.healPlayer(playerId)
    console.log(`玩家${playerId}回血`)
    removeItem(itemId)
    
    // 爱心被吃掉后2~4秒重新生成
    setTimeout(() => {
      if (gameStore.gameStarted && !gameStore.gameEnded) {
        createHeart(
          Math.random() * (canvasRef.value.width - 50) + 25,
          Math.random() * (canvasRef.value.height - 50) + 25
        )
      }
    }, 2000 + Math.random() * 2000)
  }
  
  // 组件挂载时初始化物理引擎
  onMounted(() => {
    console.log('物理引擎组件挂载')
    if (canvasRef.value) {
      initPhysics()
    } else {
      console.error('物理引擎初始化失败：Canvas未就绪')
    }
  })
  
  // 组件卸载时清理物理引擎
  onUnmounted(() => {
    console.log('物理引擎组件卸载')
    Matter.Events.off(engine, 'collisionStart', handleCollisions)
    if (isRunning.value) {
      Matter.Events.off(engine, 'afterUpdate', syncPhysicsToState)
    }
    stopPhysicsLoop()
    
    // 清理定时器
    if (noGearTimerId) {
      clearInterval(noGearTimerId)
    }
    if (trajectoryCorrectionId) {
      clearInterval(trajectoryCorrectionId)
    }
    
    Matter.World.clear(world, false)
    Matter.Engine.clear(engine)
  })
  
  return {
    isRunning,
    startGame,
    createGear,
    createHeart,
    removeItem,
    updatePlayerSpeed
  }
} 